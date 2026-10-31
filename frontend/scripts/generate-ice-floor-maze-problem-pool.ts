import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { difficultyLevels } from "@/games/difficulty";
import {
  assessIceFloorMazeDifficulty,
  type IceFloorMazeDifficulty,
  isIceFloorMazeBoardShapeOfDifficulty,
  listIceFloorMazeBoardShapes,
} from "@/games/ice-floor-maze/difficulty";
import {
  analyzeIceFloorMazeDifficulty,
  type IceFloorMazeDifficultyFeatures,
} from "@/games/ice-floor-maze/problem/difficulty-analysis";
import {
  createIceFloorMazeGeneratedProblem,
  generateIceFloorMazeBoardCandidate,
  type IceFloorMazeGeneratedProblem,
  type IceFloorMazeGoalCandidate,
} from "@/games/ice-floor-maze/problem/generator";
import {
  ICE_FLOOR_MAZE_GENERATOR_VERSION,
  type IceFloorMazeBoardShape,
} from "@/games/ice-floor-maze/problem/problem";
import type { IceFloorMazeProblemPoolEntry } from "@/games/ice-floor-maze/problem/problem-pool";
import { exploreIceFloorMazeStops } from "@/games/ice-floor-maze/puzzle/stop-graph";
import { createProblemId } from "@/games/problem-id";
import { createProblemSeededRandom } from "@/games/problem-seed";

const usage = `Usage: bun run generate:ice-floor-maze-pool -- [options]

盤面の形ごとに決定的な乱数列で盤面の候補（岩の配置と開始位置）を作り、ゴールの候補をすべて分析・分類する。
1盤面からは各レベル1問まで（ゴールの番号が最も小さいもの）を採り、回転・反転の同型を除く。
1つのレベルに盤面の形が複数あるときは、形ごとに同じ数ずつ採り、形を交互に並べる。

Options:
  --per-level <n>  レベルごとの問題数 (default: 500)
  --budget <n>     盤面の形ごとに作る盤面の候補の上限 (default: 20000)
  --examples       レベルごとの代表問題（最少手数と試行手数がレベルの中央値に近い問題）を盤面の記法で出す`;

const outputPath = new URL(
  "../src/games/ice-floor-maze/problem/problem-pool.json",
  import.meta.url,
);

type SelectedProblem = {
  generated: IceFloorMazeGeneratedProblem;
  shape: IceFloorMazeBoardShape;
  planningDepth: number;
  features: IceFloorMazeDifficultyFeatures;
};

/** 盤面の形ごとの、作った盤面の数と、レベルごとにそのレベルのゴールを選べた盤面の数。 */
type ShapeSupply = {
  shape: IceFloorMazeBoardShape;
  boardCount: number;
  milliseconds: number;
  boardCountByLevel: Map<IceFloorMazeDifficulty, number>;
  duplicateCount: number;
};

function readOption(name: string): string | undefined {
  const index = Bun.argv.indexOf(`--${name}`);
  return index >= 0 ? Bun.argv[index + 1] : undefined;
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = Number(readOption(name) ?? fallback);
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`--${name} must be a positive integer`);
  }
  return value;
}

function formatShape({ width, height }: IceFloorMazeBoardShape): string {
  return `${width}×${height}`;
}

function shapeKey({ width, height }: IceFloorMazeBoardShape): string {
  return `${width}x${height}`;
}

function listLevelShapes(
  difficulty: IceFloorMazeDifficulty,
): IceFloorMazeBoardShape[] {
  return listIceFloorMazeBoardShapes().filter((shape) =>
    isIceFloorMazeBoardShapeOfDifficulty(shape, difficulty),
  );
}

/** レベルの問題数を、そのレベルの盤面の形へ同じ数ずつ割り振る。割り切れない分は狭い形から1問ずつ足す。 */
function allocateQuota(
  difficulty: IceFloorMazeDifficulty,
  perLevel: number,
): Map<string, number> {
  const shapes = listLevelShapes(difficulty);
  return new Map(
    shapes.map((shape, index) => [
      shapeKey(shape),
      Math.floor(perLevel / shapes.length) +
        (index < perLevel % shapes.length ? 1 : 0),
    ]),
  );
}

function collectShape(
  shape: IceFloorMazeBoardShape,
  quotas: ReadonlyMap<IceFloorMazeDifficulty, number>,
  seenSymmetryKeys: Set<string>,
  budget: number,
): {
  selected: Map<IceFloorMazeDifficulty, SelectedProblem[]>;
  supply: ShapeSupply;
} {
  const random = createProblemSeededRandom(
    `ice-floor-maze-pool:${shapeKey(shape)}`,
  );
  const selected = new Map(
    [...quotas.keys()].map((difficulty) => [
      difficulty,
      [] as SelectedProblem[],
    ]),
  );
  const supply: ShapeSupply = {
    shape,
    boardCount: 0,
    milliseconds: 0,
    boardCountByLevel: new Map(),
    duplicateCount: 0,
  };
  const startedAt = performance.now();
  function isFilled(): boolean {
    return [...quotas].every(
      ([difficulty, quota]) => selected.get(difficulty)!.length >= quota,
    );
  }

  while (!isFilled()) {
    if (supply.boardCount >= budget) {
      throw new Error(
        `${formatShape(shape)} did not supply enough problems within ${budget} boards`,
      );
    }
    supply.boardCount += 1;
    const candidate = generateIceFloorMazeBoardCandidate(shape, random);
    if (!candidate) {
      continue;
    }

    const graph = exploreIceFloorMazeStops(candidate.board, candidate.start);
    const firstByLevel = new Map<
      IceFloorMazeDifficulty,
      { goalCandidate: IceFloorMazeGoalCandidate } & Omit<
        SelectedProblem,
        "generated" | "shape"
      >
    >();
    for (const goalCandidate of candidate.goalCandidates) {
      const analysis = analyzeIceFloorMazeDifficulty(
        {
          board: candidate.board,
          start: candidate.start,
          goal: goalCandidate.goal,
        },
        graph,
      );
      const assessment = assessIceFloorMazeDifficulty(analysis);
      if (
        assessment.status === "classified" &&
        analysis.status === "analyzed" &&
        !firstByLevel.has(assessment.difficulty)
      ) {
        firstByLevel.set(assessment.difficulty, {
          goalCandidate,
          planningDepth: analysis.planningDepth,
          features: analysis.features,
        });
      }
    }

    for (const [difficulty, found] of firstByLevel) {
      supply.boardCountByLevel.set(
        difficulty,
        (supply.boardCountByLevel.get(difficulty) ?? 0) + 1,
      );
      const problems = selected.get(difficulty);
      if (!problems || problems.length >= quotas.get(difficulty)!) {
        continue;
      }
      const generated = createIceFloorMazeGeneratedProblem(
        candidate,
        found.goalCandidate,
        supply.boardCount,
      );
      if (seenSymmetryKeys.has(generated.symmetryKey)) {
        supply.duplicateCount += 1;
        continue;
      }
      seenSymmetryKeys.add(generated.symmetryKey);
      problems.push({
        generated,
        shape,
        planningDepth: found.planningDepth,
        features: found.features,
      });
    }
  }
  supply.milliseconds = performance.now() - startedAt;
  return { selected, supply };
}

/** 各形の問題を、形を交互に並べて1つのレベルの並びにする。 */
function interleave(
  problemsByShape: readonly (readonly SelectedProblem[])[],
): SelectedProblem[] {
  const longest = Math.max(
    ...problemsByShape.map((problems) => problems.length),
  );
  return Array.from({ length: longest }, (_, round) =>
    problemsByShape.flatMap((problems) => {
      const problem = problems[round];
      return problem ? [problem] : [];
    }),
  ).flat();
}

function toPoolEntry({
  generated,
}: SelectedProblem): IceFloorMazeProblemPoolEntry {
  const { identity, optimalMoveCount } = generated;
  return [
    identity.seed,
    identity.conditions.width,
    identity.conditions.height,
    optimalMoveCount,
  ];
}

function formatPoolJson(
  levels: Record<IceFloorMazeDifficulty, readonly SelectedProblem[]>,
): string {
  const lines = difficultyLevels.map(
    ({ id }, levelIndex) =>
      `    ${JSON.stringify(id)}: [\n${levels[id]
        .map((problem) => `      ${JSON.stringify(toPoolEntry(problem))}`)
        .join(",\n")}\n    ]${
        levelIndex < difficultyLevels.length - 1 ? "," : ""
      }`,
  );
  return `{\n  "generatorVersion": ${JSON.stringify(ICE_FLOOR_MAZE_GENERATOR_VERSION)},\n  "levels": {\n${lines.join("\n")}\n  }\n}\n`;
}

function quantile(sorted: readonly number[], ratio: number): number {
  return sorted[
    Math.min(sorted.length - 1, Math.floor(ratio * sorted.length))
  ]!;
}

function describeDistribution(values: readonly number[]): string {
  const sorted = [...values].sort((left, right) => left - right);
  return `min=${sorted[0]} median=${quantile(sorted, 0.5)} p90=${quantile(sorted, 0.9)} max=${sorted.at(-1)}`;
}

function median(values: readonly number[]): number {
  return quantile(
    [...values].sort((left, right) => left - right),
    0.5,
  );
}

function formatCounts(values: readonly (string | number)[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
  }
  return [...counts]
    .sort(([left], [right]) =>
      left.localeCompare(right, "en", { numeric: true }),
    )
    .map(([value, count]) => `${value}=${count}`)
    .join(" ");
}

function formatPercent(part: number, whole: number): string {
  return `${((part / whole) * 100).toFixed(1)}%`;
}

function describeLevel(
  difficulty: IceFloorMazeDifficulty,
  problems: readonly SelectedProblem[],
): string[] {
  const features = problems.map((problem) => problem.features);
  return [
    `## レベル ${difficulty}: ${problems.length}問`,
    `  盤面の形: ${formatCounts(problems.map(({ shape }) => formatShape(shape)))}`,
    `  計画深さ: ${formatCounts(problems.map(({ planningDepth }) => planningDepth))}`,
    `  最少手数: ${describeDistribution(features.map(({ optimalMoveCount }) => optimalMoveCount))}`,
    `  試行手数: ${describeDistribution(features.map(({ trialMoveCount }) => trialMoveCount))}`,
    `  到達できる停止点: ${describeDistribution(features.map(({ reachableStopCount }) => reachableStopCount))}`,
    `  遠回り: ${describeDistribution(features.map(({ detourMoveCount }) => detourMoveCount))}`,
    `  最短解が一意: ${formatPercent(features.filter(({ optimalSolutionCount }) => optimalSolutionCount === 1).length, features.length)} / 詰みがある: ${formatPercent(features.filter(({ deadStopCount }) => deadStopCount > 0).length, features.length)} / ゴールを通過する滑りがある: ${formatPercent(features.filter(({ goalPassingStopCount }) => goalPassingStopCount > 0).length, features.length)}`,
    ...listLevelShapes(difficulty).map((shape) => {
      const ofShape = problems.filter(
        (problem) => shapeKey(problem.shape) === shapeKey(shape),
      );
      return `  ${formatShape(shape)}: 最少手数 中央値 ${median(ofShape.map(({ features: { optimalMoveCount } }) => optimalMoveCount))} / 試行手数 中央値 ${median(ofShape.map(({ features: { trialMoveCount } }) => trialMoveCount))} / 到達できる停止点 中央値 ${median(ofShape.map(({ features: { reachableStopCount } }) => reachableStopCount))}`;
    }),
  ];
}

function describeSupply(supply: ShapeSupply): string {
  const perBoard = supply.milliseconds / supply.boardCount;
  const levels = difficultyLevels
    .filter(({ id }) => supply.boardCountByLevel.has(id))
    .map(({ id }) => {
      const count = supply.boardCountByLevel.get(id)!;
      return `L${id} ${formatPercent(count, supply.boardCount)} / ${(perBoard / (count / supply.boardCount)).toFixed(1)}ms`;
    });
  return `${formatShape(supply.shape)}: 盤面 ${supply.boardCount} / 1盤面 ${perBoard.toFixed(1)}ms / 同型重複 ${supply.duplicateCount} / ${levels.join(" / ")}`;
}

function renderProblem({ generated }: SelectedProblem): string[] {
  const { board, start, goal } = generated.problem;
  return Array.from({ length: board.height }, (_, y) =>
    Array.from({ length: board.width }, (_, x) => {
      const cellIndex = y * board.width + x;
      if (cellIndex === start) {
        return "S";
      }
      if (cellIndex === goal) {
        return "G";
      }
      return board.cells[cellIndex] === "rock" ? "#" : ".";
    }).join(""),
  );
}

/** 最少手数と試行手数が、レベルの中央値に近い問題。 */
function findRepresentative(
  problems: readonly SelectedProblem[],
): SelectedProblem {
  const medianMoves = median(
    problems.map(({ features }) => features.optimalMoveCount),
  );
  const medianTrial = median(
    problems.map(({ features }) => features.trialMoveCount),
  );
  function distance({ features }: SelectedProblem): number {
    return (
      Math.abs(features.optimalMoveCount - medianMoves) / medianMoves +
      Math.abs(features.trialMoveCount - medianTrial) / medianTrial
    );
  }
  return problems.reduce((best, problem) =>
    distance(problem) < distance(best) ? problem : best,
  );
}

function describeExample(
  difficulty: IceFloorMazeDifficulty,
  problems: readonly SelectedProblem[],
): string[] {
  const representative = findRepresentative(problems);
  const { features, planningDepth, generated, shape } = representative;
  return [
    `## レベル ${difficulty} の代表（${formatShape(shape)}、問題 ID ${createProblemId(generated.identity)}）`,
    `計画深さ ${planningDepth}（近づく ${features.approachPlanningDepth ?? "-"} / 揃える ${features.alignPlanningDepth ?? "-"}）、最少手数 ${features.optimalMoveCount}、試行手数 ${features.trialMoveCount}、到達できる停止点 ${features.reachableStopCount}、詰みの停止点 ${features.deadStopCount}`,
    "```text",
    ...renderProblem(representative),
    "```",
  ];
}

function runMain(): void {
  if (Bun.argv.includes("--help")) {
    console.log(usage);
    return;
  }
  const perLevel = readPositiveInteger("per-level", 500);
  const budget = readPositiveInteger("budget", 20_000);
  const startedAt = performance.now();

  const quotaByLevel = new Map(
    difficultyLevels.map(({ id }) => [id, allocateQuota(id, perLevel)]),
  );
  const seenSymmetryKeys = new Set<string>();
  const problemsByLevelShape = new Map<string, SelectedProblem[]>();
  const supplies: ShapeSupply[] = [];
  for (const shape of listIceFloorMazeBoardShapes()) {
    const quotas = new Map(
      difficultyLevels
        .filter(({ id }) => quotaByLevel.get(id)!.has(shapeKey(shape)))
        .map(({ id }) => [id, quotaByLevel.get(id)!.get(shapeKey(shape))!]),
    );
    const { selected, supply } = collectShape(
      shape,
      quotas,
      seenSymmetryKeys,
      budget,
    );
    supplies.push(supply);
    for (const [difficulty, problems] of selected) {
      problemsByLevelShape.set(`${difficulty}:${shapeKey(shape)}`, problems);
    }
    console.error(describeSupply(supply));
  }

  const levels = Object.fromEntries(
    difficultyLevels.map(({ id }) => [
      id,
      interleave(
        listLevelShapes(id).map(
          (shape) => problemsByLevelShape.get(`${id}:${shapeKey(shape)}`) ?? [],
        ),
      ),
    ]),
  ) as Record<IceFloorMazeDifficulty, SelectedProblem[]>;

  const json = formatPoolJson(levels);
  writeFileSync(outputPath, json);

  const report = [
    ...supplies.map(describeSupply),
    ...difficultyLevels.flatMap(({ id }) => describeLevel(id, levels[id])),
    ...(Bun.argv.includes("--examples")
      ? difficultyLevels.flatMap(({ id }) => describeExample(id, levels[id]))
      : []),
    `全体: ${((performance.now() - startedAt) / 1000).toFixed(1)}s / JSON ${json.length} bytes, gzip ${gzipSync(json).length} bytes`,
  ];
  console.log(report.join("\n"));
}

runMain();
