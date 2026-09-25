import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import {
  assessTakuzuDifficulty,
  type TakuzuDifficulty,
  takuzuDifficulties,
} from "@/games/takuzu/difficulty";
import type { TakuzuTechnique } from "@/games/takuzu/problem/generation/human-solver";
import { generateTakuzuProblem } from "@/games/takuzu/problem/generator";
import {
  createTakuzuProblemIdentity,
  TAKUZU_GENERATOR_VERSION,
  type TakuzuProblem,
} from "@/games/takuzu/problem/problem";
import {
  decodeTakuzuPoolProblem,
  encodeTakuzuPoolProblem,
  getTakuzuRemovalTechniqueLimitCode,
  listTakuzuPoolEntries,
  type TakuzuPooledProblem,
  type TakuzuProblemPoolEntry,
  toTakuzuPooledProblem,
  toTakuzuPoolIdentity,
} from "@/games/takuzu/problem/problem-pool";
import { selectTakuzuProblemForDifficulty } from "@/games/takuzu/problem-selection";
import { calculateTakuzuSpeedFullScoreMs } from "@/games/takuzu/score";

const defaultPerLevel = 500;

const usage = `Usage: bun run generate:takuzu-pool -- [options]

難易度ごとに決めた生成条件（手筋の上限×戻す数）で、決定的な seed の候補を番号順に生成・分析する。
その難易度に分類され、空きマスの数が共通の範囲に入る候補を、同型（回転・反転・A/B 入れ替えの16通り）の
重複を除きながら生成条件を巡回して問題集へ採る。

Options:
  --per-level <n>  難易度ごとの問題数 (default: ${defaultPerLevel})
  --jobs <n>       並列ワーカー数 (default: 4)
  --block <n>      生成条件ごとに一度に増やす候補数 (default: 100)
  --budget <n>     生成条件ごとに調べる候補数の上限 (default: 20000)
  --verify         生成せず、同梱の問題集の全問を再生成→分析→分類し、作業の量・同型の重複・基準時間の分布・JSON の大きさ・選択時間を確かめる`;

const outputPath = new URL(
  "../src/games/takuzu/problem/problem-pool.json",
  import.meta.url,
);

/**
 * 問題集に採る空きマスの数の範囲。全難易度で共通にする。
 * 空きマスの数（作業量）でレベルが決まらないよう、どのレベルも同じ範囲から採る。
 * 範囲は、各レベルの主な生成条件の分布が重なる帯（タクズ難易度.md §7.3・§14.3）から決めた。
 */
const emptyCellRange = { minimum: 40, maximum: 48 } as const;

type Condition = {
  removalTechniqueLimit: TakuzuTechnique;
  extraGivenCount: number;
};

/**
 * 難易度ごとに、その難易度が現れやすい生成条件（タクズ難易度.md §7.1）。
 * 生成条件は候補を作る領域を決めるだけで、採るかどうかは分析・分類の結果で決める。
 */
const levelConditions: Record<TakuzuDifficulty, readonly Condition[]> = {
  "1": conditionsOf("adjacency", [0]),
  "2": conditionsOf("count-completion", [0, 2, 4, 6]),
  "3": conditionsOf("single-remaining", [0, 2, 4, 6]),
  "4": [
    ...conditionsOf("duplicate-avoidance", [2, 4, 6]),
    ...conditionsOf("general-line", [2, 4, 6]),
  ],
  "5": [
    ...conditionsOf("duplicate-avoidance", [0, 2, 4, 6]),
    ...conditionsOf("general-line", [0, 2, 4, 6]),
  ],
};

function conditionsOf(
  removalTechniqueLimit: TakuzuTechnique,
  extraGivenCounts: readonly number[],
): Condition[] {
  return extraGivenCounts.map((extraGivenCount) => ({
    removalTechniqueLimit,
    extraGivenCount,
  }));
}

type CandidateSummary = {
  roundCount: number;
  lineReadingRoundCount: number;
  meanSourceCount: number;
  singleSourceRoundCount: number;
  duplicateAvoidanceRoundCount: number;
  generalLineRoundCount: number;
};

type Candidate = {
  index: number;
  milliseconds: number;
  /** 分類できた候補の難易度。提供範囲外・評価不能は `null`。 */
  difficulty: TakuzuDifficulty | null;
  emptyCellCount: number;
  canonicalKey: string;
  encodedProblem: string;
  summary: CandidateSummary | null;
};

type ConditionState = {
  condition: Condition;
  /** 候補番号の順。0 から連続して埋まる。 */
  results: Candidate[];
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

function conditionKeyOf({
  removalTechniqueLimit,
  extraGivenCount,
}: Condition): string {
  return `${getTakuzuRemovalTechniqueLimitCode(removalTechniqueLimit)}${extraGivenCount}`;
}

type CellTransform = (row: number, column: number) => [number, number];

function listSymmetryTransforms(size: number): CellTransform[] {
  const last = size - 1;
  return [
    (row, column) => [row, column],
    (row, column) => [column, last - row],
    (row, column) => [last - row, last - column],
    (row, column) => [last - column, row],
    (row, column) => [row, last - column],
    (row, column) => [last - row, column],
    (row, column) => [column, row],
    (row, column) => [last - column, last - row],
  ];
}

/**
 * 回転・反転（8通り）と A/B の入れ替え（2通り）で得られる初期配置の表記のうち最小のもの。
 * 一意解の問題は初期配置で決まるので、同じ鍵の問題は同型とみなす。
 */
function createCanonicalProblemKey({ givens }: TakuzuProblem): string {
  const { size, cells } = givens;
  const keys: string[] = [];
  for (const transform of listSymmetryTransforms(size)) {
    const transformed = new Array<string>(size * size);
    cells.forEach((cell, cellIndex) => {
      const [row, column] = transform(
        Math.floor(cellIndex / size),
        cellIndex % size,
      );
      transformed[row * size + column] = cell ?? ".";
    });
    const key = transformed.join("");
    keys.push(
      key,
      key.replace(/[ab]/g, (tile) => (tile === "a" ? "b" : "a")),
    );
  }
  return keys.sort()[0]!;
}

function countEmptyCells({ givens }: TakuzuProblem): number {
  return givens.cells.filter((cell) => cell === null).length;
}

function evaluateCandidate(condition: Condition, index: number): Candidate {
  const startedAt = performance.now();
  const { problem, difficultyAnalysis } = generateTakuzuProblem(
    createTakuzuProblemIdentity(
      condition.removalTechniqueLimit,
      condition.extraGivenCount,
      index,
    ),
  );
  const assessment = assessTakuzuDifficulty(difficultyAnalysis);
  const features =
    difficultyAnalysis.status === "analyzed"
      ? difficultyAnalysis.features
      : null;
  return {
    index,
    milliseconds: performance.now() - startedAt,
    difficulty:
      assessment.status === "classified" ? assessment.difficulty : null,
    emptyCellCount: countEmptyCells(problem),
    canonicalKey: createCanonicalProblemKey(problem),
    encodedProblem: encodeTakuzuPoolProblem(problem),
    summary: features && {
      roundCount: features.roundCount,
      lineReadingRoundCount: features.lineReadingRoundCount,
      meanSourceCount: features.meanSourceCount ?? 0,
      singleSourceRoundCount: features.singleSourceRoundCount,
      duplicateAvoidanceRoundCount: features.duplicateAvoidanceRoundCount,
      generalLineRoundCount: features.roundCountByTechnique["general-line"],
    },
  };
}

function runWorker(args: readonly string[]): void {
  const [removalTechniqueLimit, extraGivenCount, start, count] = args;
  const condition = {
    removalTechniqueLimit: removalTechniqueLimit as TakuzuTechnique,
    extraGivenCount: Number(extraGivenCount),
  };
  const end = Number(start) + Number(count);
  for (let index = Number(start); index < end; index += 1) {
    console.log(JSON.stringify(evaluateCandidate(condition, index)));
  }
}

type Batch = { state: ConditionState; start: number; count: number };

async function runBatch({ state, start, count }: Batch): Promise<Candidate[]> {
  const { condition } = state;
  const worker = Bun.spawn(
    [
      process.execPath,
      Bun.fileURLToPath(import.meta.url),
      "--worker",
      condition.removalTechniqueLimit,
      String(condition.extraGivenCount),
      String(start),
      String(count),
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  const output = await new Response(worker.stdout).text();
  if ((await worker.exited) !== 0) {
    throw new Error(`Worker failed for ${conditionKeyOf(condition)}`);
  }
  return output
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Candidate);
}

async function runBatches(
  batches: readonly Batch[],
  jobs: number,
): Promise<void> {
  const queue = [...batches];
  const results = new Map<Batch, Candidate[]>();
  await Promise.all(
    Array.from({ length: jobs }, async () => {
      for (let batch = queue.shift(); batch; batch = queue.shift()) {
        results.set(batch, await runBatch(batch));
      }
    }),
  );
  // 完了順ではなく候補番号の順に積む。
  for (const batch of [...batches].sort(
    (left, right) => left.start - right.start,
  )) {
    batch.state.results.push(...results.get(batch)!);
  }
}

type SelectedCandidate = { condition: Condition; candidate: Candidate };

function isEligible(
  candidate: Candidate,
  difficulty: TakuzuDifficulty,
): boolean {
  return (
    candidate.difficulty === difficulty &&
    candidate.emptyCellCount >= emptyCellRange.minimum &&
    candidate.emptyCellCount <= emptyCellRange.maximum
  );
}

type LevelSelection = {
  selected: SelectedCandidate[];
  duplicateCount: number;
  /** 生成条件ごとの、採る問題を決めるまでに調べた候補数。 */
  examinedLengths: Map<ConditionState, number>;
};

/**
 * 生成条件を巡回し、各条件の採れる候補を番号順に1つずつ採る。同型の重複は飛ばす。
 * 採る問題は各条件の候補の番号順の並びだけで決まり、ワーカー数や一度に調べる候補数に依存しない。
 * 巡回がまだ調べていない候補に届いたら、候補を増やす必要があるので `null` を返す。
 */
function selectLevel(
  difficulty: TakuzuDifficulty,
  states: readonly ConditionState[],
  perLevel: number,
  budget: number,
): LevelSelection | null {
  const queues = states.map((state) =>
    state.results
      .slice(0, budget)
      .filter((candidate) => isEligible(candidate, difficulty)),
  );
  const selected: SelectedCandidate[] = [];
  const examinedLengths = new Map<ConditionState, number>(
    states.map((state) => [state, 0]),
  );
  const seenKeys = new Set<string>();
  let duplicateCount = 0;
  for (let round = 0; selected.length < perLevel; round += 1) {
    let hasCandidate = false;
    for (const [conditionIndex, state] of states.entries()) {
      if (selected.length >= perLevel) {
        break;
      }
      const candidate = queues[conditionIndex]![round];
      if (!candidate) {
        if (state.results.length < budget) {
          return null;
        }
        continue;
      }
      hasCandidate = true;
      examinedLengths.set(state, candidate.index + 1);
      if (seenKeys.has(candidate.canonicalKey)) {
        duplicateCount += 1;
        continue;
      }
      seenKeys.add(candidate.canonicalKey);
      selected.push({ condition: state.condition, candidate });
    }
    if (!hasCandidate) {
      throw new Error(
        `Level ${difficulty} could not reach ${perLevel} problems within ${budget} candidates per condition`,
      );
    }
  }
  return { selected, duplicateCount, examinedLengths };
}

function quantile(sorted: readonly number[], ratio: number): number {
  return sorted[
    Math.min(sorted.length - 1, Math.floor(ratio * sorted.length))
  ]!;
}

function describeDistribution(values: readonly number[], digits = 0): string {
  const sorted = [...values].sort((left, right) => left - right);
  return ["min", 0, "p25", 0.25, "median", 0.5, "p75", 0.75]
    .reduce<string[]>((parts, value, index, array) => {
      if (index % 2 === 0) {
        parts.push(
          `${value}=${quantile(sorted, array[index + 1] as number).toFixed(digits)}`,
        );
      }
      return parts;
    }, [])
    .concat(`max=${sorted.at(-1)!.toFixed(digits)}`)
    .join(" ");
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

function formatPoolJson(
  levels: Record<TakuzuDifficulty, TakuzuProblemPoolEntry[]>,
): string {
  const lines = takuzuDifficulties.map(
    ({ id }, levelIndex) =>
      `    ${JSON.stringify(id)}: [\n${levels[id]
        .map((entry) => `      ${JSON.stringify(entry)}`)
        .join(
          ",\n",
        )}\n    ]${levelIndex < takuzuDifficulties.length - 1 ? "," : ""}`,
  );
  return `{\n  "generatorVersion": ${JSON.stringify(TAKUZU_GENERATOR_VERSION)},\n  "levels": {\n${lines.join("\n")}\n  }\n}\n`;
}

/** 速さの基準時間（秒）の分布。問題集の作業の量から、プレイ時と同じ式で求める。 */
function describeSpeedFullScore(
  pooledProblems: readonly TakuzuPooledProblem[],
): string {
  return `  速さの基準時間（秒）: ${describeDistribution(
    pooledProblems.map(
      ({ workload }) => calculateTakuzuSpeedFullScoreMs(workload) / 1000,
    ),
  )}`;
}

function describeSize(json: string): string {
  return `JSON ${json.length} bytes, gzip ${gzipSync(json).length} bytes`;
}

async function runMain(): Promise<void> {
  const perLevel = readPositiveInteger("per-level", defaultPerLevel);
  const jobs = readPositiveInteger("jobs", 4);
  const block = readPositiveInteger("block", 100);
  const budget = readPositiveInteger("budget", 20_000);
  const startedAt = performance.now();

  const statesByKey = new Map<string, ConditionState>();
  const levelStates = Object.fromEntries(
    takuzuDifficulties.map(({ id }) => [
      id,
      levelConditions[id].map((condition) => {
        const key = conditionKeyOf(condition);
        const state = statesByKey.get(key) ?? { condition, results: [] };
        statesByKey.set(key, state);
        return state;
      }),
    ]),
  ) as Record<TakuzuDifficulty, ConditionState[]>;

  const prefixLengths = Object.fromEntries(
    takuzuDifficulties.map(({ id }) => [id, 0]),
  ) as Record<TakuzuDifficulty, number>;
  const results = new Map<TakuzuDifficulty, LevelSelection>();

  for (;;) {
    const pending = takuzuDifficulties
      .map(({ id }) => id)
      .filter((id) => !results.has(id));
    if (pending.length === 0) {
      break;
    }
    const requiredLengths = new Map<ConditionState, number>();
    for (const difficulty of pending) {
      prefixLengths[difficulty] = Math.min(
        prefixLengths[difficulty] + block,
        budget,
      );
      for (const state of levelStates[difficulty]) {
        requiredLengths.set(
          state,
          Math.max(requiredLengths.get(state) ?? 0, prefixLengths[difficulty]),
        );
      }
    }
    const batches: Batch[] = [...requiredLengths]
      .map(([state, length]) => ({
        state,
        start: state.results.length,
        count: length - state.results.length,
      }))
      .filter((batch) => batch.count > 0);
    await runBatches(batches, jobs);
    for (const difficulty of pending) {
      const selection = selectLevel(
        difficulty,
        levelStates[difficulty],
        perLevel,
        budget,
      );
      if (selection) {
        results.set(difficulty, selection);
      }
    }
    console.error(
      `${Math.round((performance.now() - startedAt) / 1000)}s ${takuzuDifficulties
        .map(
          ({ id }) =>
            `${id}:${results.has(id) ? "done" : `${prefixLengths[id]}/条件`}`,
        )
        .join(" ")}`,
    );
  }
  const wallSeconds = (performance.now() - startedAt) / 1000;

  const levels = {} as Record<TakuzuDifficulty, TakuzuProblemPoolEntry[]>;
  const report: string[] = [];
  for (const { id: difficulty } of takuzuDifficulties) {
    const { selected, duplicateCount, examinedLengths } =
      results.get(difficulty)!;
    levels[difficulty] = selected.map(({ condition, candidate }) => [
      getTakuzuRemovalTechniqueLimitCode(condition.removalTechniqueLimit),
      condition.extraGivenCount,
      candidate.index,
      candidate.encodedProblem,
      candidate.summary!.roundCount,
      candidate.summary!.lineReadingRoundCount,
    ]);

    const examined = levelStates[difficulty].flatMap((state) =>
      state.results.slice(0, examinedLengths.get(state)),
    );
    const classifiedCount = examined.filter(
      (candidate) => candidate.difficulty === difficulty,
    ).length;
    const eligibleCount = examined.filter((candidate) =>
      isEligible(candidate, difficulty),
    ).length;
    const cpuSeconds =
      examined.reduce((sum, candidate) => sum + candidate.milliseconds, 0) /
      1000;
    const summaries = selected.map(({ candidate }) => candidate.summary!);
    function percentage(count: number): string {
      return `${((count / examined.length) * 100).toFixed(1)}%`;
    }
    report.push(
      `## 難易度 ${difficulty}: ${selected.length}問`,
      `  候補 ${examined.length} / 分類一致 ${classifiedCount} (${percentage(classifiedCount)}) / 空きマスの範囲内 ${eligibleCount} (${percentage(eligibleCount)}) / 同型重複 ${duplicateCount} / 候補の計算 ${cpuSeconds.toFixed(1)}s (CPU)`,
      `  生成条件: ${formatCounts(selected.map(({ condition }) => conditionKeyOf(condition)))}`,
      `  空きマス: ${formatCounts(selected.map(({ candidate }) => candidate.emptyCellCount))}`,
      `  空きマスの分布: ${describeDistribution(selected.map(({ candidate }) => candidate.emptyCellCount))}`,
      `  分類一致した候補の空きマスの分布（範囲で絞る前）: ${describeDistribution(examined.filter((candidate) => candidate.difficulty === difficulty).map((candidate) => candidate.emptyCellCount))}`,
      `  ラウンド数: ${describeDistribution(summaries.map((summary) => summary.roundCount))}`,
      `  確定を与える場所の数の平均: ${describeDistribution(
        summaries.map((summary) => summary.meanSourceCount),
        1,
      )}`,
      `  場所が1か所しかない局面の数: ${describeDistribution(summaries.map((summary) => summary.singleSourceRoundCount))}`,
      `  重複の回避が要った局面の数: ${formatCounts(summaries.map((summary) => summary.duplicateAvoidanceRoundCount))}`,
      `  E が要った問題: ${summaries.filter((summary) => summary.generalLineRoundCount > 0).length}`,
      describeSpeedFullScore(
        levels[difficulty].map((entry) => toTakuzuPooledProblem(entry)),
      ),
    );
  }

  const json = formatPoolJson(levels);
  writeFileSync(outputPath, json);
  console.log(report.join("\n"));
  console.log(
    `\n全体: ${wallSeconds.toFixed(1)}s (wall, jobs=${jobs}) / ${describeSize(json)}`,
  );
}

type VerifyFailure = {
  difficulty: TakuzuDifficulty;
  index: number;
  reason: string;
};

function runVerifyWorker(args: readonly string[]): void {
  const [jobIndex, jobCount] = args.map(Number);
  for (const { id: difficulty } of takuzuDifficulties) {
    listTakuzuPoolEntries(difficulty).forEach((entry, index) => {
      if (index % jobCount! !== jobIndex) {
        return;
      }
      function fail(reason: string): void {
        console.log(JSON.stringify({ difficulty, index, reason }));
      }
      const { problem, difficultyAnalysis } = generateTakuzuProblem(
        toTakuzuPoolIdentity(entry),
      );
      if (encodeTakuzuPoolProblem(problem) !== entry[3]) {
        fail("identity から再生成した問題が問題集と違う");
      }
      if (difficultyAnalysis.status !== "analyzed") {
        fail(`一意解で論理的に解き切れない (${difficultyAnalysis.status})`);
        return;
      }
      const { roundCount, lineReadingRoundCount } = difficultyAnalysis.features;
      if (entry[4] !== roundCount || entry[5] !== lineReadingRoundCount) {
        fail(
          `作業の量が分析と違う (局面 ${entry[4]}/${roundCount}, 行・列を読む局面 ${entry[5]}/${lineReadingRoundCount})`,
        );
      }
      const assessment = assessTakuzuDifficulty(difficultyAnalysis);
      if (
        assessment.status !== "classified" ||
        assessment.difficulty !== difficulty
      ) {
        fail(`難易度が一致しない (${JSON.stringify(assessment)})`);
      }
      const emptyCellCount = countEmptyCells(problem);
      if (
        emptyCellCount < emptyCellRange.minimum ||
        emptyCellCount > emptyCellRange.maximum
      ) {
        fail(`空きマスの数が範囲外 (${emptyCellCount})`);
      }
    });
  }
}

function measureSelection(): string {
  const durations: number[] = [];
  for (const { id: difficulty } of takuzuDifficulties) {
    for (let index = 0; index < 2000; index += 1) {
      const startedAt = performance.now();
      selectTakuzuProblemForDifficulty(difficulty, `measure-${index}`);
      durations.push(performance.now() - startedAt);
    }
  }
  durations.sort((left, right) => left - right);
  const mean =
    durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
  return `選択+復元 ${durations.length}回: mean=${mean.toFixed(3)}ms p99=${quantile(durations, 0.99).toFixed(3)}ms max=${durations.at(-1)!.toFixed(3)}ms`;
}

async function runVerify(): Promise<void> {
  const jobs = readPositiveInteger("jobs", 4);
  const startedAt = performance.now();
  const outputs = await Promise.all(
    Array.from({ length: jobs }, async (_, jobIndex) => {
      const worker = Bun.spawn(
        [
          process.execPath,
          Bun.fileURLToPath(import.meta.url),
          "--verify-worker",
          String(jobIndex),
          String(jobs),
        ],
        { stdout: "pipe", stderr: "inherit" },
      );
      const output = await new Response(worker.stdout).text();
      if ((await worker.exited) !== 0) {
        throw new Error(`Verify worker ${jobIndex} failed`);
      }
      return output;
    }),
  );
  const failures = outputs
    .join("\n")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as VerifyFailure);

  const keys = new Set<string>();
  let duplicateCount = 0;
  let total = 0;
  const levels = {} as Record<TakuzuDifficulty, TakuzuProblemPoolEntry[]>;
  for (const { id: difficulty } of takuzuDifficulties) {
    levels[difficulty] = [...listTakuzuPoolEntries(difficulty)];
    for (const entry of levels[difficulty]) {
      total += 1;
      const key = createCanonicalProblemKey(decodeTakuzuPoolProblem(entry[3]));
      if (keys.has(key)) {
        duplicateCount += 1;
      }
      keys.add(key);
    }
  }

  console.log(
    `${total}問を検証 (${((performance.now() - startedAt) / 1000).toFixed(1)}s, jobs=${jobs}): 不合格 ${failures.length} / 同型重複 ${duplicateCount}`,
  );
  for (const failure of failures) {
    console.log(
      `  難易度 ${failure.difficulty} の ${failure.index}番: ${failure.reason}`,
    );
  }
  for (const { id: difficulty } of takuzuDifficulties) {
    console.log(
      `難易度 ${difficulty}${describeSpeedFullScore(levels[difficulty].map((entry) => toTakuzuPooledProblem(entry)))}`,
    );
  }
  console.log(describeSize(formatPoolJson(levels)));
  console.log(measureSelection());
  if (failures.length > 0 || duplicateCount > 0) {
    process.exitCode = 1;
  }
}

if (Bun.argv.includes("--help")) {
  console.log(usage);
} else if (Bun.argv.includes("--worker")) {
  runWorker(Bun.argv.slice(Bun.argv.indexOf("--worker") + 1));
} else if (Bun.argv.includes("--verify-worker")) {
  runVerifyWorker(Bun.argv.slice(Bun.argv.indexOf("--verify-worker") + 1));
} else if (Bun.argv.includes("--verify")) {
  await runVerify();
} else {
  await runMain();
}
