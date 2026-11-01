import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { difficultyLevels } from "@/games/difficulty";
import {
  assessIceFloorMazeDifficulty,
  type IceFloorMazeDifficulty,
  type IceFloorMazeElementPattern,
  type IceFloorMazeTacticPattern,
  iceFloorMazeCommonConditions,
  iceFloorMazeLevelCriteria,
} from "@/games/ice-floor-maze/difficulty";
import {
  analyzeIceFloorMazeDifficulty,
  type IceFloorMazeDifficultyAnalysis,
} from "@/games/ice-floor-maze/problem/difficulty-analysis";
import type { ElementVariant } from "@/games/ice-floor-maze/problem/generation/element-objective";
import {
  type ElementSearchSettings,
  fullElementSearch,
} from "@/games/ice-floor-maze/problem/generation/element-search";
import { getIceFloorMazeSymmetryKey } from "@/games/ice-floor-maze/problem/generation/symmetry";
import { createTacticWeights } from "@/games/ice-floor-maze/problem/generation/tactic-search";
import {
  generateIceFloorMazeProblem,
  type IceFloorMazeGenerationRecipe,
} from "@/games/ice-floor-maze/problem/generator";
import {
  ICE_FLOOR_MAZE_GENERATOR_VERSION,
  type IceFloorMazeBoardShape,
} from "@/games/ice-floor-maze/problem/problem";
import {
  type IceFloorMazeProblemPool,
  type IceFloorMazeProblemPoolEntry,
  restoreIceFloorMazePoolEntry,
} from "@/games/ice-floor-maze/problem/problem-pool";

function formatUsage(): string {
  return `Usage: bun run generate:ice-floor-maze-pool -- [options]

レベルの基準（difficulty.ts）の挑戦の型ごとに生成条件を作り、seed の番号順に山登りで問題を作る。
各生成条件の結果を seed の番号順に見て、そのレベルに分類され、同型が無い問題を採る。採る問題はワーカー数に依存しない。
1つのレベルの生成条件が複数あるときは同じ数ずつ採り、生成条件を交互に並べる。

Options:
  --static-per-level <n>   氷と岩だけのレベル（1・2）の問題数 (default: 500)
  --element-per-level <n>  要素のあるレベル（3〜5）の問題数 (default: 300)
  --levels <list>          作り直すレベル（例: 3,4）。ほかのレベルは今の問題集のまま (default: すべて)
  --search <list>          要素のあるレベルの山登りの止め方（例: 3=early,3-brittle-rock=full,5=full）
                           early は採用条件を満たした時点で打ち切り、full は最後まで回す (default: ${formatSearchModes(defaultSearchModes)})
  --jobs <n>               並列ワーカー数 (default: 4)
  --compare <n>            問題集を書かず、要素のある各生成条件で n 回ずつ early と full を回して時間と難しさを比べる
  --verify                 問題集を書かず、今の問題集の全問を分析し直してレベルと最少手数を確かめる`;
}

const outputPath = new URL(
  "../src/games/ice-floor-maze/problem/problem-pool.json",
  import.meta.url,
);

type SearchMode = "early" | "full";

/**
 * レベル（`3`）か、レベルと要素の種類（`3-brittle-rock`）ごとの山登りの止め方。種類の指定がレベルの指定より優先する。
 * もろい岩は条件1（同じ向きが続く手）を満たしにくく、打ち切る方式では 1,000 回までに採用条件を満たす回が少ないので、最後まで回す。
 */
type SearchModes = Readonly<Record<string, SearchMode>>;

const defaultSearchModes: SearchModes = {
  "3": "early",
  "3-brittle-rock": "full",
  "4": "early",
  "5": "full",
};

function findSearchMode(
  modes: SearchModes,
  difficulty: IceFloorMazeDifficulty,
  composition: IceFloorMazeElementPattern["composition"],
): SearchMode {
  return modes[`${difficulty}-${composition}`] ?? modes[difficulty] ?? "full";
}

const earlyElementSearch = {
  iterations: 3000,
  stopWhenAccepted: true,
  minimumHardness: 0,
  giveUpAfter: 1000,
} as const satisfies ElementSearchSettings;

const searchSettings = {
  early: earlyElementSearch,
  full: fullElementSearch,
} as const satisfies Record<SearchMode, ElementSearchSettings>;

/** 要素のある問題の盤面と、その盤面で求める最少手数（研究用の生成 v4 の `SHAPES`）。 */
const elementShapes = {
  small: { width: 8, height: 8, shortest: { minimum: 12, maximum: 15 } },
  medium: { width: 10, height: 10, shortest: { minimum: 14, maximum: 19 } },
  large: { width: 10, height: 12, shortest: { minimum: 17, maximum: 22 } },
} as const;

/** L3 は要素が少ないので、同じ盤面で短めの手数を求める。 */
const shortElementShapes = {
  small: { width: 8, height: 8, shortest: { minimum: 10, maximum: 14 } },
  medium: { width: 10, height: 10, shortest: { minimum: 12, maximum: 16 } },
} as const;

type ElementShape = {
  width: number;
  height: number;
  shortest: { minimum: number; maximum: number };
};

/** 要素のあるレベルの生成条件で、挑戦の型ごとに使う盤面。 */
const elementShapesByLevel = {
  "3": [shortElementShapes.small, shortElementShapes.medium],
  "4": [elementShapes.small, elementShapes.medium],
  "5": [elementShapes.medium, elementShapes.large],
} as const satisfies Record<"3" | "4" | "5", readonly ElementShape[]>;

const variantByComposition = {
  "brittle-rock": "brittle-rock",
  "thin-ice": "thin-ice",
  mixed: "mixed",
} as const satisfies Record<
  IceFloorMazeElementPattern["composition"],
  ElementVariant
>;

const TACTIC_ITERATIONS = 2000;
const TACTIC_MAXIMUM_ROCK_DENSITY = 0.34;
const ELEMENT_MAXIMUM_ROCK_DENSITY = 0.3;

/**
 * 1つの生成条件。`build` は seed の番号から山登りの条件を作る。氷と岩だけの条件は、研究用の v2 と同じく
 * 最少手数の上限を番号ごとに範囲内で回し、手数を範囲に散らす。
 */
type GenerationPlan = {
  label: string;
  build: (index: number) => IceFloorMazeGenerationRecipe;
};

function buildTacticPlan(
  difficulty: IceFloorMazeDifficulty,
  shape: IceFloorMazeBoardShape,
  pattern: IceFloorMazeTacticPattern,
): GenerationPlan {
  const { minimum, maximum } = pattern.optimalMoveCount;
  const weights = createTacticWeights(pattern.required, pattern.forbidden);
  // 読みの浅い問題を求める型では、読み深さを点にしない（易しい問題を作るため。研究用 v2 の L1 と同じ）。
  const readsShallowly = pattern.readingDepth.maximum <= 2;
  return {
    label: `L${difficulty} 氷と岩 ${shape.width}×${shape.height} ${minimum}〜${maximum}手 +${pattern.required.join("+")}`,
    build(index) {
      const cap = minimum + (index % (maximum - minimum + 1));
      return {
        kind: "tactics",
        recipe: {
          width: shape.width,
          height: shape.height,
          shortest: { minimum: Math.max(minimum, cap - 1), maximum: cap },
          weights: readsShallowly ? { ...weights, read: 0 } : weights,
          iterations: TACTIC_ITERATIONS,
          maximumRockDensity: TACTIC_MAXIMUM_ROCK_DENSITY,
        },
      };
    },
  };
}

function buildElementPlan(
  difficulty: IceFloorMazeDifficulty,
  shape: ElementShape,
  pattern: IceFloorMazeElementPattern,
  mode: SearchMode,
): GenerationPlan {
  const variant = variantByComposition[pattern.composition];
  const settings = searchSettings[mode];
  return {
    label: `L${difficulty} ${variant} ${shape.width}×${shape.height} ${shape.shortest.minimum}〜${shape.shortest.maximum}手 要素${pattern.elementCount.minimum}〜${pattern.elementCount.maximum} ${mode}`,
    build() {
      return {
        kind: "elements",
        recipe: {
          variant,
          width: shape.width,
          height: shape.height,
          shortest: shape.shortest,
          elements: pattern.elementCount,
          minimumEach:
            variant === "mixed"
              ? iceFloorMazeCommonConditions.minimumEachInMixed
              : 0,
          minimumUses: iceFloorMazeCommonConditions.minimumUses,
          decoyShare: iceFloorMazeCommonConditions.decoyShare,
          forcedShare: iceFloorMazeCommonConditions.forcedShare,
          maximumRockDensity: ELEMENT_MAXIMUM_ROCK_DENSITY,
        },
        search: settings,
      };
    },
  };
}

function listPlans(
  difficulty: IceFloorMazeDifficulty,
  modes: SearchModes,
): GenerationPlan[] {
  const criteria = iceFloorMazeLevelCriteria[difficulty];
  if (criteria.kind === "tactics") {
    return criteria.patterns.map((pattern) =>
      buildTacticPlan(difficulty, criteria.largestBoardShape, pattern),
    );
  }
  const elementDifficulty = difficulty as "3" | "4" | "5";
  return criteria.patterns.flatMap((pattern) =>
    elementShapesByLevel[elementDifficulty].map((shape) =>
      buildElementPlan(
        difficulty,
        shape,
        pattern,
        findSearchMode(modes, difficulty, pattern.composition),
      ),
    ),
  );
}

/** ワーカーが返す1つの seed の結果。採れなかった理由は `rejection`。 */
type TaskResult = {
  index: number;
  seconds: number;
  acceptedAtIteration: number | null;
  rejection: string | null;
  difficulty: IceFloorMazeDifficulty | null;
  entry: IceFloorMazeProblemPoolEntry | null;
  symmetryKey: string | null;
  analysis: IceFloorMazeDifficultyAnalysis | null;
};

function describeRejection(
  assessment: ReturnType<typeof assessIceFloorMazeDifficulty>,
): string {
  switch (assessment.status) {
    case "classified":
      return `L${assessment.difficulty} に分類`;
    case "out-of-range":
      return assessment.reason === "unmet-conditions"
        ? assessment.unmetConditions.join("+")
        : `組合せ外（${assessment.composition} ${assessment.optimalMoveCount}手）`;
    default:
      return assessment.reason;
  }
}

function runTask(plan: GenerationPlan, index: number, seedLabel: string) {
  const startedAt = performance.now();
  const generated = generateIceFloorMazeProblem(
    plan.build(index),
    `${seedLabel}-${index}`,
  );
  const seconds = (performance.now() - startedAt) / 1000;
  if (!generated) {
    return {
      index,
      seconds,
      acceptedAtIteration: null,
      rejection: "生成できない（打ち切り・手数・形）",
      difficulty: null,
      entry: null,
      symmetryKey: null,
      analysis: null,
    } satisfies TaskResult;
  }
  const assessment = assessIceFloorMazeDifficulty(generated.analysis);
  const { identity } = generated;
  return {
    index,
    seconds,
    acceptedAtIteration: generated.acceptedAtIteration,
    rejection:
      assessment.status === "classified" ? null : describeRejection(assessment),
    difficulty:
      assessment.status === "classified" ? assessment.difficulty : null,
    entry: [
      identity.seed,
      identity.conditions.width,
      identity.conditions.height,
      generated.optimalMoveCount,
    ],
    symmetryKey: generated.symmetryKey,
    analysis: generated.analysis,
  } satisfies TaskResult;
}

function parseSearchModes(value: string | undefined): SearchModes {
  if (!value) {
    return defaultSearchModes;
  }
  return Object.fromEntries(
    value.split(",").map((part) => {
      const [key, mode] = part.split("=");
      if (!key || (mode !== "early" && mode !== "full")) {
        throw new RangeError(`--search: ${part}`);
      }
      return [key, mode];
    }),
  );
}

function formatSearchModes(modes: Record<string, SearchMode>): string {
  return Object.entries(modes)
    .map(([level, mode]) => `${level}=${mode}`)
    .join(",");
}

/** ワーカー: 1つの生成条件の seed の番号の範囲を順に作り、結果を1行ずつ JSON で出す。 */
function runWorker(args: readonly string[]): void {
  const [difficulty, planIndex, searchValue, seedLabel, first, count] = args;
  const plan = listPlans(
    difficulty as IceFloorMazeDifficulty,
    parseSearchModes(searchValue),
  )[Number(planIndex)]!;
  for (
    let index = Number(first);
    index < Number(first) + Number(count);
    index += 1
  ) {
    console.log(JSON.stringify(runTask(plan, index, seedLabel!)));
  }
}

type PlanState = {
  difficulty: IceFloorMazeDifficulty;
  planIndex: number;
  plan: GenerationPlan;
  seedLabel: string;
  searchValue: string;
  quota: number;
  batchSize: number;
  scheduled: number;
  results: TaskResult[];
  accepted: TaskResult[];
  seenKeys: Set<string>;
  duplicateCount: number;
  finished: boolean;
};

async function runBatch(
  state: PlanState,
  first: number,
  count: number,
): Promise<TaskResult[]> {
  const worker = Bun.spawn(
    [
      process.execPath,
      Bun.fileURLToPath(import.meta.url),
      "--worker",
      state.difficulty,
      String(state.planIndex),
      state.searchValue,
      state.seedLabel,
      String(first),
      String(count),
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  const output = await new Response(worker.stdout).text();
  if ((await worker.exited) !== 0) {
    throw new Error(`Worker failed for ${state.plan.label}`);
  }
  return output
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as TaskResult);
}

/** seed の番号順に、届いた結果を先頭から採る。番号が飛んでいるところで止まる。 */
function absorbResults(
  state: PlanState,
  isAccepted: (result: TaskResult) => boolean,
): void {
  state.results.sort((left, right) => left.index - right.index);
  let cursor = 0;
  state.accepted = [];
  state.seenKeys.clear();
  state.duplicateCount = 0;
  for (const result of state.results) {
    if (result.index !== cursor || state.accepted.length >= state.quota) {
      break;
    }
    cursor += 1;
    if (!isAccepted(result)) {
      continue;
    }
    if (result.symmetryKey !== null) {
      if (state.seenKeys.has(result.symmetryKey)) {
        state.duplicateCount += 1;
        continue;
      }
      state.seenKeys.add(result.symmetryKey);
    }
    state.accepted.push(result);
  }
  state.finished = state.accepted.length >= state.quota;
}

/** 採れる割合の見込みから、残りを埋めるのに要る seed の数。 */
function estimateNeeded(
  state: PlanState,
  isAccepted: (result: TaskResult) => boolean,
): number {
  const done = state.results.length;
  const acceptedCount = state.results.filter(isAccepted).length;
  const rate = Math.max(0.05, (acceptedCount + 1) / (done + 2));
  return Math.ceil((state.quota - state.accepted.length) / rate);
}

async function runPlans(
  states: readonly PlanState[],
  jobs: number,
  isAccepted: (state: PlanState) => (result: TaskResult) => boolean,
  onProgress: (state: PlanState) => void,
): Promise<void> {
  function nextBatch(): {
    state: PlanState;
    first: number;
    count: number;
  } | null {
    const pending = states
      .filter((state) => !state.finished)
      .map((state) => ({
        state,
        outstanding: state.scheduled - state.results.length,
        needed: estimateNeeded(state, isAccepted(state)),
      }))
      .filter(({ outstanding, needed }) => outstanding < needed)
      .sort(
        (left, right) =>
          left.state.scheduled / left.state.quota -
          right.state.scheduled / right.state.quota,
      );
    const chosen = pending[0];
    if (!chosen) {
      return null;
    }
    const { state } = chosen;
    const first = state.scheduled;
    state.scheduled += state.batchSize;
    return { state, first, count: state.batchSize };
  }
  const running = new Set<Promise<void>>();
  for (;;) {
    if (states.every((state) => state.finished)) {
      break;
    }
    for (
      let batch = running.size < jobs ? nextBatch() : null;
      batch;
      batch = running.size < jobs ? nextBatch() : null
    ) {
      const { state, first, count } = batch;
      if (state.scheduled > MAXIMUM_SEEDS_PER_QUOTA * state.quota + 100) {
        throw new Error(`${state.plan.label}: too few problems are accepted`);
      }
      const task: Promise<void> = runBatch(state, first, count)
        .then((results) => {
          state.results.push(...results);
          absorbResults(state, isAccepted(state));
          onProgress(state);
        })
        .then(() => {
          running.delete(task);
        });
      running.add(task);
    }
    if (running.size === 0) {
      throw new Error("Ice floor maze pool generation stalled");
    }
    await Promise.race(running);
  }
  await Promise.all(running);
}

/** 1問あたりに試す seed の上限。採れる割合がこれより低い生成条件は、条件を見直す。 */
const MAXIMUM_SEEDS_PER_QUOTA = 40;

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

function quantile(sorted: readonly number[], ratio: number): number {
  return sorted[
    Math.min(sorted.length - 1, Math.floor(ratio * sorted.length))
  ]!;
}

function describeDistribution(values: readonly number[]): string {
  if (values.length === 0) {
    return "-";
  }
  const sorted = [...values].sort((left, right) => left - right);
  const format = (value: number) => String(Number(value.toFixed(1)));
  return `min=${format(sorted[0]!)} p10=${format(quantile(sorted, 0.1))} median=${format(quantile(sorted, 0.5))} p90=${format(quantile(sorted, 0.9))} max=${format(sorted.at(-1)!)}`;
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

function describePlan(state: PlanState): string[] {
  const results = state.results;
  const seconds = results.map((result) => result.seconds);
  const total = seconds.reduce((sum, value) => sum + value, 0);
  const acceptedCount = results.filter(
    (result) => result.difficulty === state.difficulty,
  ).length;
  return [
    `### ${state.plan.label}`,
    `  seed ${results.length} / 採用 ${acceptedCount}（${((acceptedCount / Math.max(1, results.length)) * 100).toFixed(0)}%） / 同型重複 ${state.duplicateCount} / 1回 平均 ${(total / Math.max(1, results.length)).toFixed(2)}s / 1問 ${(total / Math.max(1, acceptedCount)).toFixed(2)}s（1コア）`,
    `  外れた理由: ${formatCounts(results.flatMap((result) => (result.rejection ? [result.rejection] : [])))}`,
  ];
}

function describeLevel(
  difficulty: IceFloorMazeDifficulty,
  accepted: readonly TaskResult[],
): string[] {
  const analyses = accepted.map((result) => result.analysis!);
  const shapes = accepted.map(
    (result) => `${result.entry![1]}×${result.entry![2]}`,
  );
  const lines = [
    `## レベル ${difficulty}: ${accepted.length}問`,
    `  盤面の形: ${formatCounts(shapes)}`,
    `  最少手数: ${describeDistribution(accepted.map((result) => result.entry![3]))}`,
  ];
  const tactic = analyses.flatMap((analysis) =>
    analysis.status === "analyzed" && analysis.composition === "none"
      ? [analysis.features]
      : [],
  );
  if (tactic.length > 0) {
    lines.push(
      `  読み深さ: ${formatCounts(tactic.map((features) => features.readingDepth ?? "-"))}`,
      `  近い別解: ${describeDistribution(tactic.map((features) => features.nearPathCount))}`,
      `  到達できる停止点: ${describeDistribution(tactic.map((features) => features.reachableStopCount))}`,
      `  手筋のタグ: ${formatCounts(tactic.flatMap((features) => features.tags))}`,
    );
  }
  const element = analyses.flatMap((analysis) =>
    analysis.status === "analyzed" && analysis.composition !== "none"
      ? [{ composition: analysis.composition, features: analysis.features }]
      : [],
  );
  if (element.length > 0) {
    lines.push(
      `  要素の種類: ${formatCounts(element.map(({ composition }) => composition))}`,
      `  要素の数: ${formatCounts(element.map(({ features }) => features.elementCount))}`,
      `  おとり: ${formatCounts(element.map(({ features }) => features.decoyCount))}`,
      `  使う回数: ${describeDistribution(element.map(({ features }) => features.useCount))}`,
      `  状態の数: ${describeDistribution(element.map(({ features }) => features.reachableStateCount))}`,
      `  状態の読み深さ: ${formatCounts(element.map(({ features }) => features.stateReadingDepth ?? "-"))}`,
      `  見た目どおりの読み: ${formatCounts(element.map(({ features }) => features.looksReading))}`,
      `  難しさの点: ${describeDistribution(element.map(({ features }) => features.hardness))}`,
      ...(["brittle-rock", "thin-ice", "mixed"] as const).flatMap(
        (composition) => {
          const ofComposition = element.filter(
            (item) => item.composition === composition,
          );
          return ofComposition.length > 0
            ? [
                `    ${composition}: ${ofComposition.length}問 難しさ ${describeDistribution(ofComposition.map(({ features }) => features.hardness))} / 最少手数 ${describeDistribution(ofComposition.map(({ features }) => features.optimalMoveCount))}`,
              ]
            : [];
        },
      ),
    );
  }
  return lines;
}

/** 各生成条件の問題を、生成条件を交互に並べて1つのレベルの並びにする。 */
function interleave(groups: readonly (readonly TaskResult[])[]): TaskResult[] {
  const longest = Math.max(0, ...groups.map((group) => group.length));
  return Array.from({ length: longest }, (_, round) =>
    groups.flatMap((group) => (group[round] ? [group[round]] : [])),
  ).flat();
}

function formatPoolJson(
  levels: Record<
    IceFloorMazeDifficulty,
    readonly IceFloorMazeProblemPoolEntry[]
  >,
): string {
  const lines = difficultyLevels.map(
    ({ id }, levelIndex) =>
      `    ${JSON.stringify(id)}: [\n${levels[id]
        .map((entry) => `      ${JSON.stringify(entry)}`)
        .join(
          ",\n",
        )}\n    ]${levelIndex < difficultyLevels.length - 1 ? "," : ""}`,
  );
  return `{\n  "generatorVersion": ${JSON.stringify(ICE_FLOOR_MAZE_GENERATOR_VERSION)},\n  "levels": {\n${lines.join("\n")}\n  }\n}\n`;
}

function readCurrentPool(): IceFloorMazeProblemPool {
  return JSON.parse(
    readFileSync(outputPath, "utf8"),
  ) as IceFloorMazeProblemPool;
}

function createPlanStates(
  levels: readonly IceFloorMazeDifficulty[],
  modes: SearchModes,
  quotaOf: (
    difficulty: IceFloorMazeDifficulty,
    planCount: number,
    planIndex: number,
  ) => number,
  seedPrefix: string,
): PlanState[] {
  return levels.flatMap((difficulty) => {
    const plans = listPlans(difficulty, modes);
    return plans.map((plan, planIndex) => ({
      difficulty,
      planIndex,
      plan,
      seedLabel: `${seedPrefix}-L${difficulty}-${planIndex}`,
      searchValue: formatSearchModes(modes),
      quota: quotaOf(difficulty, plans.length, planIndex),
      batchSize:
        iceFloorMazeLevelCriteria[difficulty].kind === "tactics" ? 8 : 1,
      scheduled: 0,
      results: [],
      accepted: [],
      seenKeys: new Set<string>(),
      duplicateCount: 0,
      finished: false,
    }));
  });
}

function logProgress(state: PlanState): void {
  console.error(
    `${state.plan.label}: ${state.accepted.length}/${state.quota}（seed ${state.results.length}）`,
  );
}

async function runGenerate(): Promise<void> {
  const staticPerLevel = readPositiveInteger("static-per-level", 500);
  const elementPerLevel = readPositiveInteger("element-per-level", 300);
  const jobs = readPositiveInteger("jobs", 4);
  const modes = parseSearchModes(readOption("search"));
  const levelOption = readOption("levels");
  const levels = difficultyLevels
    .map(({ id }) => id)
    .filter((id) => !levelOption || levelOption.split(",").includes(id));
  const startedAt = performance.now();

  const states = createPlanStates(
    levels,
    modes,
    (difficulty, planCount, planIndex) => {
      const perLevel =
        iceFloorMazeLevelCriteria[difficulty].kind === "tactics"
          ? staticPerLevel
          : elementPerLevel;
      return (
        Math.floor(perLevel / planCount) +
        (planIndex < perLevel % planCount ? 1 : 0)
      );
    },
    "pool",
  );
  await runPlans(
    states,
    jobs,
    (state) => (result) => result.difficulty === state.difficulty,
    logProgress,
  );
  const wallSeconds = (performance.now() - startedAt) / 1000;

  const current = readCurrentPool();
  const levelEntries = Object.fromEntries(
    difficultyLevels.map(({ id }) => {
      const mine = states.filter((state) => state.difficulty === id);
      return [
        id,
        mine.length > 0
          ? interleave(mine.map((state) => state.accepted)).map(
              (result) => result.entry!,
            )
          : current.levels[id],
      ];
    }),
  ) as Record<IceFloorMazeDifficulty, IceFloorMazeProblemPoolEntry[]>;
  const allKeys = difficultyLevels.flatMap(({ id }) =>
    levelEntries[id].map((entry) =>
      getIceFloorMazeSymmetryKey(restoreIceFloorMazePoolEntry(entry).problem),
    ),
  );
  if (new Set(allKeys).size !== allKeys.length) {
    throw new Error(
      "Ice floor maze pool has symmetric duplicates across levels",
    );
  }
  const json = formatPoolJson(levelEntries);
  writeFileSync(outputPath, json);

  const cpuSeconds = states
    .flatMap((state) => state.results)
    .reduce((sum, result) => sum + result.seconds, 0);
  const report = [
    ...states.flatMap(describePlan),
    ...levels.flatMap((id) =>
      describeLevel(
        id,
        interleave(
          states
            .filter((state) => state.difficulty === id)
            .map((state) => state.accepted),
        ),
      ),
    ),
    ...levels.map((id) => {
      const levelSeconds = states
        .filter((state) => state.difficulty === id)
        .flatMap((state) => state.results)
        .reduce((sum, result) => sum + result.seconds, 0);
      return `L${id} の生成: ${(levelSeconds / 60).toFixed(1)}分（1コアの合計）`;
    }),
    `全体: ${(wallSeconds / 60).toFixed(1)}分（wall, jobs=${jobs}）/ 1コアの合計 ${(cpuSeconds / 60).toFixed(1)}分 / 山登りの止め方 ${formatSearchModes(modes)}`,
    `JSON ${json.length} bytes, gzip ${gzipSync(json).length} bytes`,
  ];
  console.log(report.join("\n"));
}

/** 要素のある生成条件ごとに、打ち切る方式と最後まで回す方式を同じ seed で比べる。 */
async function runCompare(runs: number): Promise<void> {
  const jobs = readPositiveInteger("jobs", 4);
  const levelOption = readOption("levels");
  const levels = (["3", "4", "5"] as const).filter(
    (id) => !levelOption || levelOption.split(",").includes(id),
  );
  const startedAt = performance.now();
  const allStates = (["early", "full"] as const).flatMap((mode) =>
    createPlanStates(
      levels,
      { "3": mode, "4": mode, "5": mode },
      () => runs,
      "compare",
    ),
  );
  for (const state of allStates) {
    state.batchSize = 1;
  }
  // 比べるときは採否によらず runs 回ずつ回す。
  await runPlans(allStates, jobs, () => () => true, logProgress);
  const lines: string[] = [];
  for (const state of allStates) {
    const results = state.results.slice(0, runs);
    const accepted = results.filter(
      (result) => result.difficulty === state.difficulty,
    );
    const seconds = results.map((result) => result.seconds);
    const total = seconds.reduce((sum, value) => sum + value, 0);
    const hardness = accepted.flatMap((result) =>
      result.analysis?.status === "analyzed" &&
      result.analysis.composition !== "none"
        ? [result.analysis.features.hardness]
        : [],
    );
    lines.push(
      `${state.plan.label}: 採用 ${accepted.length}/${results.length} / 1回 ${(total / results.length).toFixed(1)}s（${describeDistribution(seconds)}）/ 1問 ${(total / Math.max(1, accepted.length)).toFixed(1)}s / 難しさ ${describeDistribution(hardness)} / 採用条件を初めて満たした回 ${describeDistribution(accepted.flatMap((result) => (result.acceptedAtIteration === null ? [] : [result.acceptedAtIteration])))}`,
      `  外れた理由: ${formatCounts(results.flatMap((result) => (result.rejection ? [result.rejection] : [])))}`,
    );
  }
  lines.push(
    `全体: ${((performance.now() - startedAt) / 60000).toFixed(1)}分（wall, jobs=${jobs}）`,
  );
  console.log(lines.join("\n"));
}

/** 今の問題集の全問を分析し直し、レベルと最少手数を確かめる。 */
function runVerifyWorker(args: readonly string[]): void {
  const [difficulty, first, count] = args;
  const entries =
    readCurrentPool().levels[difficulty as IceFloorMazeDifficulty];
  for (const entry of entries.slice(
    Number(first),
    Number(first) + Number(count),
  )) {
    const { problem, optimalMoveCount } = restoreIceFloorMazePoolEntry(entry);
    const analysis = analyzeIceFloorMazeDifficulty(problem);
    const assessment = assessIceFloorMazeDifficulty(analysis);
    const ok =
      assessment.status === "classified" &&
      assessment.difficulty === difficulty &&
      analysis.status === "analyzed" &&
      analysis.features.optimalMoveCount === optimalMoveCount;
    console.log(JSON.stringify({ seed: entry[0], ok, assessment }));
  }
}

async function runVerify(): Promise<void> {
  const jobs = readPositiveInteger("jobs", 4);
  const pool = readCurrentPool();
  const startedAt = performance.now();
  const chunks = difficultyLevels.flatMap(({ id }) =>
    Array.from(
      { length: Math.ceil(pool.levels[id].length / 25) },
      (_, part) => [id, part * 25] as const,
    ),
  );
  const failures: string[] = [];
  let total = 0;
  await Promise.all(
    Array.from({ length: jobs }, async () => {
      for (let chunk = chunks.shift(); chunk; chunk = chunks.shift()) {
        const worker = Bun.spawn(
          [
            process.execPath,
            Bun.fileURLToPath(import.meta.url),
            "--verify-worker",
            chunk[0],
            String(chunk[1]),
            "25",
          ],
          { stdout: "pipe", stderr: "inherit" },
        );
        const output = await new Response(worker.stdout).text();
        for (const line of output.trim().split("\n").filter(Boolean)) {
          const result = JSON.parse(line) as {
            seed: string;
            ok: boolean;
            assessment: unknown;
          };
          total += 1;
          if (!result.ok) {
            failures.push(
              `L${chunk[0]} ${result.seed}: ${JSON.stringify(result.assessment)}`,
            );
          }
        }
      }
    }),
  );
  console.log(
    [
      ...failures,
      `${total}問を検証（${((performance.now() - startedAt) / 1000).toFixed(1)}s, jobs=${jobs}）: 不合格 ${failures.length}`,
    ].join("\n"),
  );
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

async function runMain(): Promise<void> {
  if (Bun.argv.includes("--help")) {
    console.log(formatUsage());
    return;
  }
  if (Bun.argv.includes("--worker")) {
    runWorker(Bun.argv.slice(Bun.argv.indexOf("--worker") + 1));
    return;
  }
  if (Bun.argv.includes("--verify-worker")) {
    runVerifyWorker(Bun.argv.slice(Bun.argv.indexOf("--verify-worker") + 1));
    return;
  }
  if (Bun.argv.includes("--verify")) {
    await runVerify();
    return;
  }
  const compareRuns = readOption("compare");
  if (compareRuns) {
    await runCompare(Number(compareRuns));
    return;
  }
  await runGenerate();
}

await runMain();
