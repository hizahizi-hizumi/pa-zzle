/**
 * 魔方陣の難易度（版 8）の確かめと計測。本番の読むモデル・分類・生成器をそのまま使い、本番挙動は変えない。
 */

import { difficultyLevels } from "@/games/difficulty";
import {
  assessMagicSquareDifficulty,
  classifyMagicSquareReadingOnBoard,
  findMagicSquareDisagreeingReading,
  MAGIC_SQUARE_SWEEP_LIMIT,
} from "@/games/magic-square/difficulty";
import {
  analyzeMagicSquareDifficulty,
  type MagicSquareReadingFeatures,
  summarizeMagicSquareReading,
} from "@/games/magic-square/problem/difficulty-analysis";
import { listAllMagicSquares4 } from "@/games/magic-square/problem/generation/answers";
import {
  createMagicSquareCandidateRandom,
  formatMagicSquareCandidateConditions,
  generateMagicSquareCandidate,
  type MagicSquareCandidateConditions,
} from "@/games/magic-square/problem/generation/candidate";
import reference from "@/games/magic-square/problem/generation/difficulty-reference.json";
import { readMagicSquare } from "@/games/magic-square/problem/generation/read-model";
import { listMagicSquareReadingCombinations } from "@/games/magic-square/problem/generation/reading-parts";
import { countMagicSquareSolutions } from "@/games/magic-square/problem/generation/solver";
import {
  type MagicSquareTrialDisplay,
  traceMagicSquareTrialSolve,
} from "@/games/magic-square/problem/generation/trial-solver";
import type { MagicSquareBoardSize } from "@/games/magic-square/problem/problem";
import {
  listMagicSquarePoolEntries,
  restoreMagicSquarePoolEntry,
  toMagicSquarePoolIdentity,
} from "@/games/magic-square/problem/problem-pool";
import { createProblemId } from "@/games/problem-id";
import { createProblemSeededRandom } from "@/games/problem-seed";

const usage = `Usage: bun scripts/analyze-magic-square-difficulty.ts <command> [options]

Commands:
  reference  移植の期待値（difficulty-reference.json の 88 候補）の全部で、レベル・範囲外の理由と、部品の組み合わせで
             基準と違うレベルになる最初の組と確かめた数を突き合わせる（単体テストは軽い候補だけを確かめる）
  timing     生成条件ごとに先頭の候補を作って分類し、1候補の時間と当たるレベルを出す
             --conditions <id>[,<id>...]（既定は全部。例: 5-T3-polish5） --count <n>（既定 12）
  pool       同梱の問題集の全問を、基準の読むモデルの特徴と素朴な解き方（表示3通り × 無作為・慣れた試し置き、1問3回、
             上限は空きの20倍の手）で測り、レベル・盤面ごとの分布と、試遊に渡す代表・最も弱い・境界・異常な問題を出す`;

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function runReference(): void {
  const combinations = listMagicSquareReadingCombinations();
  let mismatches = 0;
  for (const entry of reference.cases) {
    const startedAt = performance.now();
    const analysis = analyzeMagicSquareDifficulty(entry.size, entry.givens);
    const assessment = assessMagicSquareDifficulty(analysis);
    const actual: Record<string, unknown> = {
      level:
        assessment.status === "classified"
          ? Number(assessment.difficulty)
          : null,
      reason: assessment.status === "out-of-range" ? assessment.reason : null,
    };
    const expected: Record<string, unknown> = {
      level: entry.level,
      reason: entry.reason,
    };
    if (entry.combinations !== null && analysis.status === "analyzed") {
      // 調査コードは、盤面の割り当てを当てない基準のレベルと、組み合わせだけを比べた。
      const { level } = classifyMagicSquareReadingOnBoard(
        analysis.features.reading,
        () => analysis.features.virtualReading,
        { sweepLimit: MAGIC_SQUARE_SWEEP_LIMIT, boardSize: null },
      );
      const readingId =
        level === null
          ? null
          : findMagicSquareDisagreeingReading(analysis, level);
      const position = combinations.findIndex(({ id }) => id === readingId);
      actual.firstDisagreeing = readingId;
      actual.checked = readingId === null ? combinations.length : position + 1;
      expected.firstDisagreeing = entry.combinations.firstDisagreeing;
      expected.checked = entry.combinations.checked;
    }
    const matches = JSON.stringify(actual) === JSON.stringify(expected);
    mismatches += matches ? 0 : 1;
    console.log(
      [
        matches ? "ok" : "MISMATCH",
        entry.id,
        JSON.stringify(actual),
        matches ? "" : `expected ${JSON.stringify(expected)}`,
        `${Math.round(performance.now() - startedAt)}ms`,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }
  console.log(`${reference.cases.length} cases, ${mismatches} mismatches`);
  process.exitCode = mismatches === 0 ? 0 : 1;
}

/** 調査で当たりやすかった生成条件（難易度の資料 §6.2）。 */
const timingConditions: readonly MagicSquareCandidateConditions[] = [
  { size: 4, maxTier: 1, finish: { kind: "add-back", count: 0 } },
  { size: 4, maxTier: 2, finish: { kind: "add-back", count: 0 } },
  { size: 4, maxTier: 2, finish: { kind: "add-back", count: 1 } },
  { size: 4, maxTier: 3, finish: { kind: "add-back", count: 1 } },
  ...([5, 6] as const).flatMap((size: MagicSquareBoardSize) => [
    { size, maxTier: 2, finish: { kind: "add-back", count: 0 } } as const,
    { size, maxTier: 2, finish: { kind: "add-back", count: 1 } } as const,
    { size, maxTier: 2, finish: { kind: "add-back", count: 2 } } as const,
    { size, maxTier: 2, finish: { kind: "polish", target: "5" } } as const,
    { size, maxTier: 2, finish: { kind: "polish", target: "4" } } as const,
    { size, maxTier: 3, finish: { kind: "polish", target: "5" } } as const,
    { size, maxTier: 3, finish: { kind: "polish", target: "4" } } as const,
  ]),
];

function quantile(values: readonly number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.floor(ratio * sorted.length))
  ]!;
}

function runTiming(): void {
  const count = Number(readOption("--count") ?? 12);
  const selected = readOption("--conditions")?.split(",");
  const conditions = timingConditions.filter(
    (candidate) =>
      !selected ||
      selected.includes(formatMagicSquareCandidateConditions(candidate)),
  );
  // 4×4 の答えは全部の魔方陣から選ぶ。数え上げは1プロセスで1回なので、時間に入れない。
  listAllMagicSquares4();
  for (const condition of conditions) {
    const generateMs: number[] = [];
    const assessMs: number[] = [];
    const outcomes = new Map<string, number>();
    for (let index = 0; index < count; index += 1) {
      const generatedAt = performance.now();
      const candidate = generateMagicSquareCandidate(
        condition,
        createMagicSquareCandidateRandom(condition, index),
      );
      const assessedAt = performance.now();
      const assessment = assessMagicSquareDifficulty(
        analyzeMagicSquareDifficulty(condition.size, candidate.givens),
      );
      const finishedAt = performance.now();
      generateMs.push(assessedAt - generatedAt);
      assessMs.push(finishedAt - assessedAt);
      const outcome =
        assessment.status === "classified"
          ? `L${assessment.difficulty}`
          : assessment.status === "out-of-range"
            ? assessment.reason
            : assessment.status;
      outcomes.set(outcome, (outcomes.get(outcome) ?? 0) + 1);
    }
    const seconds = (values: readonly number[]) =>
      `${(quantile(values, 0.5) / 1000).toFixed(2)}/${(quantile(values, 0.95) / 1000).toFixed(2)}`;
    const total = generateMs.map((value, index) => value + assessMs[index]!);
    const mean = total.reduce((sum, value) => sum + value, 0) / count / 1000;
    console.log(
      [
        formatMagicSquareCandidateConditions(condition),
        `n=${count}`,
        `generate p50/p95 ${seconds(generateMs)}s`,
        `assess p50/p95 ${seconds(assessMs)}s`,
        `mean ${mean.toFixed(2)}s`,
        [...outcomes]
          .sort(([left], [right]) => (left < right ? -1 : 1))
          .map(([outcome, value]) => `${outcome}:${value}`)
          .join(" "),
      ].join("  "),
    );
  }
}

/** 素朴な解き方の上限: 空きの数のこの倍の手。 */
const TRIAL_MOVE_LIMIT_PER_EMPTY_CELL = 20;
const TRIAL_RUN_COUNT = 3;

const trialModes = [
  { id: "remain-random", display: "remain", pairAware: false },
  { id: "remain-pair", display: "remain", pairAware: true },
  { id: "filled-pair", display: "filled", pairAware: true },
  { id: "none-pair", display: "none", pairAware: true },
] as const satisfies readonly {
  id: string;
  display: MagicSquareTrialDisplay;
  pairAware: boolean;
}[];

type PoolProblem = {
  /** 解く手順の指紋: 所ごとの段と巡の並び。 */
  fingerprint: string;
  level: string;
  size: number;
  problemId: string;
  seed: string;
  emptyCount: number;
  givenCount: number;
  reading: MagicSquareReadingFeatures;
  /** 表示と試し置きの組ごとの、3回の [解けたか, 戻した回数, 置いた回数]。 */
  trials: Record<
    (typeof trialModes)[number]["id"],
    [boolean, number, number][]
  >;
};

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function formatQuantiles(values: readonly number[], digits = 0): string {
  return [0.1, 0.5, 0.9]
    .map((ratio) => quantile(values, ratio).toFixed(digits))
    .join(" / ");
}

function measurePoolProblem(
  level: string,
  entry: Parameters<typeof restoreMagicSquarePoolEntry>[0],
): PoolProblem {
  const { problem, identity } = restoreMagicSquarePoolEntry(entry);
  const { size, cells } = problem.givens;
  const givens = cells.map((cell) => cell ?? 0);
  const emptyCount = givens.filter((value) => value === 0).length;
  const read = readMagicSquare(size, givens);
  const trials = Object.fromEntries(
    trialModes.map(({ id, display, pairAware }) => [
      id,
      Array.from({ length: TRIAL_RUN_COUNT }, (_, run) => {
        const trace = traceMagicSquareTrialSolve({
          size,
          givens,
          random: createProblemSeededRandom(`${identity.seed}:${id}:${run}`),
          display,
          pairAware,
          moveLimit: TRIAL_MOVE_LIMIT_PER_EMPTY_CELL * emptyCount,
        });
        return [trace.solved, trace.undoCount, trace.moveCount] as [
          boolean,
          number,
          number,
        ];
      }),
    ]),
  ) as PoolProblem["trials"];
  return {
    level,
    size,
    problemId: createProblemId(toMagicSquarePoolIdentity(entry)),
    seed: identity.seed,
    emptyCount,
    givenCount: givens.length - emptyCount,
    reading: summarizeMagicSquareReading(read),
    fingerprint: read.steps
      .map(({ tier, sweeps }) => `${tier}:${sweeps}`)
      .join(" "),
    trials,
  };
}

/** 慣れた試し置き（違反の表示あり）の3回の戻した回数の中央値。 */
const pairUndoMedian = (problem: PoolProblem) =>
  median(problem.trials["remain-pair"].map(([, undoCount]) => undoCount));

const representativeKeys = [
  (problem: PoolProblem) => problem.emptyCount,
  (problem: PoolProblem) => problem.reading.firstSweeps,
  (problem: PoolProblem) => problem.reading.tier2SweepsMax,
  (problem: PoolProblem) => problem.reading.tier3PlaceCount,
  (problem: PoolProblem) => problem.reading.stuckPlaceCount,
  (problem: PoolProblem) => problem.reading.reworkedPlaceCount,
];

/** 特徴ごとの中央値からの離れ（10〜90 パーセンタイルの幅で割る）の和が最も小さい問題。 */
function pickRepresentative(problems: readonly PoolProblem[]): PoolProblem {
  const scales = representativeKeys.map((key) => {
    const values = problems.map(key);
    return {
      center: median(values),
      width: Math.max(1, quantile(values, 0.9) - quantile(values, 0.1)),
    };
  });
  const distance = (problem: PoolProblem) =>
    representativeKeys.reduce(
      (sum, key, index) =>
        sum +
        Math.abs(key(problem) - scales[index]!.center) / scales[index]!.width,
      0,
    );
  return [...problems].sort(
    (left, right) => distance(left) - distance(right),
  )[0]!;
}

function describeProblem(problem: PoolProblem): string {
  const { reading } = problem;
  return `\`${problem.problemId}\`（${problem.size}×${problem.size}、与える数 ${problem.givenCount}・空き ${problem.emptyCount}、入口 ${reading.entryCellCount}、最初の所 段${reading.firstTier}・${reading.firstSweeps}巡、段2の巡の最大 ${reading.tier2SweepsMax}、段3の所 ${reading.tier3PlaceCount}、組の突き合わせ ${reading.stuckPlaceCount}、慣れた試し置きの戻し ${pairUndoMedian(problem)}）`;
}

/** 盤面を文字の格子で書く（空きは `.`）。 */
function formatGrid(size: number, values: readonly number[]): string {
  const width = String(size * size).length;
  return Array.from({ length: size }, (_, row) =>
    values
      .slice(row * size, row * size + size)
      .map((value) => (value === 0 ? "." : String(value)).padStart(width))
      .join(" "),
  ).join("\n");
}

/** 独立した確かめ（F1）に渡す、与える数と答えの格子。 */
function printProblemGrid(label: string, problem: PoolProblem): void {
  const givens = problem.seed.split(".").map(Number);
  const [solution] = countMagicSquareSolutions(problem.size, givens, {
    limit: 1,
    collect: true,
  }).solutions;
  console.log(`\n### ${label}: ${describeProblem(problem)}\n`);
  console.log("```text");
  console.log(formatGrid(problem.size, givens));
  console.log("");
  console.log(formatGrid(problem.size, solution ?? []));
  console.log("```");
}

function runPool(): void {
  const problems = difficultyLevels.flatMap(({ id }) =>
    listMagicSquarePoolEntries(id).map((entry) =>
      measurePoolProblem(id, entry),
    ),
  );
  console.log("## D1 素朴な解き方（1問3回、上限は空きの20倍の手）");
  console.log(
    "| レベル | 盤面 | 慣れた試し置きの戻し（10 / 50 / 90） | 1度も戻さずに解けた割合 | 手数 ÷ 空き（10 / 50 / 90） | 無作為の試し置きが上限内に解けた割合 | 埋まった列だけ・何も出さないで解けた割合 |",
  );
  console.log("| ---: | ---: | --- | ---: | --- | ---: | --- |");
  for (const { id: level } of difficultyLevels) {
    for (const size of [0, 4, 5, 6]) {
      const group = problems.filter(
        (problem) =>
          problem.level === level && (size === 0 || problem.size === size),
      );
      if (group.length === 0) {
        continue;
      }
      const pairRuns = group.flatMap(
        (problem) => problem.trials["remain-pair"],
      );
      const rate = (
        runs: readonly [boolean, number, number][],
        predicate: (run: [boolean, number, number]) => boolean,
      ) => (runs.filter(predicate).length / runs.length).toFixed(2);
      console.log(
        `| ${level} | ${size === 0 ? "全" : `${size}×${size}`} | ${formatQuantiles(group.map(pairUndoMedian))} | ${rate(pairRuns, ([solved, undoCount]) => solved && undoCount === 0)} | ${formatQuantiles(
          group.flatMap((problem) =>
            problem.trials["remain-pair"]
              .filter(([solved]) => solved)
              .map(([, , moveCount]) => moveCount / problem.emptyCount),
          ),
          1,
        )} | ${rate(
          group.flatMap((problem) => problem.trials["remain-random"]),
          ([solved]) => solved,
        )} | ${rate(
          group.flatMap((problem) => problem.trials["filled-pair"]),
          ([solved]) => solved,
        )}・${rate(
          group.flatMap((problem) => problem.trials["none-pair"]),
          ([solved]) => solved,
        )} |`,
      );
    }
  }
  console.log("\n## 下流に渡す量（10 / 50 / 90）");
  console.log(
    "| レベル | 盤面 | 件数 | 空き | 与える数 | 入口のマス | 最初の1マスの巡 | 段2の所の巡の最大 | 段3の所の数 | 組の突き合わせ | 絞り直し | 巡の合計 | 組の数を他で使わない |",
  );
  console.log(
    "| ---: | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const { id: level } of difficultyLevels) {
    for (const size of [4, 5, 6]) {
      const group = problems.filter(
        (problem) => problem.level === level && problem.size === size,
      );
      if (group.length === 0) {
        continue;
      }
      const values = (read: (problem: PoolProblem) => number) =>
        formatQuantiles(group.map(read));
      console.log(
        `| ${level} | ${size}×${size} | ${group.length} | ${values(({ emptyCount }) => emptyCount)} | ${values(({ givenCount }) => givenCount)} | ${values(({ reading }) => reading.entryCellCount)} | ${values(({ reading }) => reading.firstSweeps)} | ${values(({ reading }) => reading.tier2SweepsMax)} | ${values(({ reading }) => reading.tier3PlaceCount)} | ${values(({ reading }) => reading.stuckPlaceCount)} | ${values(({ reading }) => reading.reworkedPlaceCount)} | ${values(({ reading }) => reading.stuckSweepTotal)} | ${values(({ reading }) => reading.lockPlaceCount)} |`,
      );
    }
  }
  console.log(
    "\n## 1か所を読む重さと読みの種類（B3・B5）と解く手順の指紋（E3）",
  );
  console.log(
    "| レベル | 件数 | いちばん重い単位の組の数（10 / 50 / 90） | 鎖の列の数の最大（10 / 50 / 90） | 組の数を他で使わないが効いた | この数はここだけで決まった | 鎖を読んだ | 段3の所がある | 指紋の種類 | 1つの指紋の最多 |",
  );
  console.log(
    "| ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  );
  for (const { id: level } of difficultyLevels) {
    const group = problems.filter((problem) => problem.level === level);
    const share = (predicate: (problem: PoolProblem) => boolean) =>
      `${Math.round((group.filter(predicate).length / group.length) * 100)}%`;
    const fingerprints = new Map<string, number>();
    for (const { fingerprint } of group) {
      fingerprints.set(fingerprint, (fingerprints.get(fingerprint) ?? 0) + 1);
    }
    console.log(
      `| ${level} | ${group.length} | ${formatQuantiles(group.map(({ reading }) => reading.combinationCountMax))} | ${formatQuantiles(group.map(({ reading }) => reading.chainLineCountMax))} | ${share(({ reading }) => reading.lockPlaceCount > 0)} | ${share(({ reading }) => reading.hiddenOnlyPlaceCount > 0)} | ${share(({ reading }) => reading.chainLineCountMax >= 2)} | ${share(({ reading }) => reading.tier3PlaceCount > 0)} | ${fingerprints.size} | ${Math.max(...fingerprints.values())} |`,
    );
  }
  console.log("\n## 試遊に渡す問題");
  const representatives: [string, PoolProblem][] = [];
  for (const { id: level } of difficultyLevels) {
    for (const size of [4, 5, 6]) {
      const group = problems.filter(
        (problem) => problem.level === level && problem.size === size,
      );
      if (group.length === 0) {
        continue;
      }
      const weakest = [...group].sort(
        (left, right) =>
          pairUndoMedian(left) - pairUndoMedian(right) ||
          left.reading.stuckSweepTotal - right.reading.stuckSweepTotal,
      )[0]!;
      const heaviest = [...group].sort(
        (left, right) =>
          right.reading.stuckSweepTotal - left.reading.stuckSweepTotal ||
          pairUndoMedian(right) - pairUndoMedian(left),
      )[0]!;
      const representative = pickRepresentative(group);
      representatives.push([`L${level} ${size}×${size} 代表`, representative]);
      console.log(
        `- L${level} ${size}×${size} 代表: ${describeProblem(representative)}`,
      );
      console.log(
        `- L${level} ${size}×${size} 最も弱い: ${describeProblem(weakest)}`,
      );
      console.log(
        `- L${level} ${size}×${size} 読みの量が最も多い: ${describeProblem(heaviest)}`,
      );
    }
  }
  // 境界: 同じ盤面で隣のレベルに分かれた対のうち、空きと組の突き合わせの回数が最も近い対。
  for (const [lower, upper] of [
    ["2", "3"],
    ["3", "4"],
    ["4", "5"],
  ] as const) {
    for (const size of [5, 6]) {
      const lowers = problems.filter(
        (problem) => problem.level === lower && problem.size === size,
      );
      const uppers = problems.filter(
        (problem) => problem.level === upper && problem.size === size,
      );
      let best: [PoolProblem, PoolProblem] | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const left of lowers) {
        for (const right of uppers) {
          const distance =
            Math.abs(left.emptyCount - right.emptyCount) +
            Math.abs(
              left.reading.stuckPlaceCount - right.reading.stuckPlaceCount,
            ) +
            Math.abs(pairUndoMedian(left) - pairUndoMedian(right)) / 10;
          if (distance < bestDistance) {
            bestDistance = distance;
            best = [left, right];
          }
        }
      }
      if (best) {
        console.log(
          `- 境界 L${lower}/L${upper} ${size}×${size}: ${describeProblem(best[0])} / ${describeProblem(best[1])}`,
        );
      }
    }
  }
  const pushedThrough = problems.filter(
    (problem) =>
      (problem.level === "4" || problem.level === "5") &&
      problem.trials["remain-pair"].every(
        ([solved, undoCount]) => solved && undoCount === 0,
      ),
  );
  console.log(
    `- 異常 L4・L5 で慣れた試し置きが3回とも戻さずに解けた問題: ${pushedThrough.length} 問${pushedThrough
      .slice(0, 3)
      .map((problem) => ` ${describeProblem(problem)}`)
      .join("")}`,
  );
  console.log("\n## 代表の盤面（上が与える数、下が答え）");
  for (const [label, problem] of representatives) {
    printProblemGrid(label, problem);
  }
}

const command = process.argv[2];
if (command === "reference") {
  runReference();
} else if (command === "timing") {
  runTiming();
} else if (command === "pool") {
  runPool();
} else {
  console.error(usage);
  process.exitCode = 1;
}
