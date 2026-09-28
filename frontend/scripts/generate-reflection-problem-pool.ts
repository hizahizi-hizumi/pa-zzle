import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import {
  assessReflectionDifficulty,
  listReflectionGenerationConditions,
  type ReflectionDifficulty,
  reflectionDifficulties,
} from "@/games/reflection/difficulty";
import { analyzeReflectionDifficulty } from "@/games/reflection/problem/difficulty-analysis";
import { getReflectionSymmetryKey } from "@/games/reflection/problem/generation/symmetry";
import { generateReflectionProblem } from "@/games/reflection/problem/generator";
import {
  createReflectionProblemIdentity,
  REFLECTION_GENERATOR_VERSION,
  type ReflectionBoardSize,
  type ReflectionGenerationConditions,
} from "@/games/reflection/problem/problem";
import {
  decodeReflectionPoolSolution,
  encodeReflectionPoolSolution,
  formatReflectionPoolProblemId,
  listReflectionPoolEntries,
  type ReflectionProblemPoolEntry,
  restoreReflectionPoolEntry,
  toReflectionPooledProblem,
  toReflectionPoolIdentity,
} from "@/games/reflection/problem/problem-pool";
import { selectReflectionProblemForDifficulty } from "@/games/reflection/problem-selection";
import { reflectionPieces } from "@/games/reflection/puzzle/board";

const defaultPerLevel = 500;

/**
 * 問題集の版。問題の並び（問題番号 `<レベル>-<番号>` が指す問題）が変わる作り直しをしたら上げる。
 * 生成器の版（`REFLECTION_GENERATOR_VERSION`）が上がったときも並びは変わるので上げる。
 */
const poolVersion = "1";

const usage = `Usage: bun run generate:reflection-pool -- [options]

レベルごとに、組み合わせ定義（reflectionLevelCombinations）の規模の範囲にある生成条件（盤面サイズ×ピース数）で、
決定的な seed の候補を番号順に生成・分析する。そのレベルに分類された候補を、回転・反転（8通り）の同型の重複を
除きながら生成条件を巡回して問題集へ採る。

Options:
  --per-level <n>  レベルごとの問題数 (default: ${defaultPerLevel})
  --jobs <n>       並列ワーカー数 (default: 4)
  --block <n>      生成条件ごとに一度に増やす候補数 (default: 100)
  --budget <n>     生成条件ごとに調べる候補数の上限 (default: 20000)
  --verify         生成せず、同梱の問題集の全問を再生成→一意性確認→分析→分類し、作業の量・同型の重複・JSON の大きさ・選択時間を確かめる`;

const outputPath = new URL(
  "../src/games/reflection/problem/problem-pool.json",
  import.meta.url,
);

/**
 * 候補を分析した結果の区分。`L1`〜`L5` は分析できた候補の最高推論レベル（分類の成否は問わない）。
 */
type CandidateOutcome =
  | "L1"
  | "L2"
  | "L3"
  | "L4"
  | "L5"
  | "unsupported"
  | "invalid";

type Candidate = {
  index: number;
  milliseconds: number;
  outcome: CandidateOutcome;
  /** 分類できた候補のレベル。提供範囲外・評価不能・不成立は `null`。 */
  difficulty: ReflectionDifficulty | null;
  symmetryKey: string;
  encodedSolution: string;
  pieceKindCount: number;
  propagationRoundCount: number;
  assumptionTestCount: number;
};

type ConditionState = {
  condition: ReflectionGenerationConditions;
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
  size,
  pieceCount,
}: ReflectionGenerationConditions): string {
  return `${size}×${size}/${pieceCount}`;
}

function evaluateCandidate(
  condition: ReflectionGenerationConditions,
  index: number,
): Candidate {
  const startedAt = performance.now();
  const { problem, symmetryKey } = generateReflectionProblem(
    createReflectionProblemIdentity(
      condition.size,
      condition.pieceCount,
      index,
    ),
  );
  const analysis = analyzeReflectionDifficulty(problem);
  const assessment = assessReflectionDifficulty(analysis);
  const features = analysis.status === "analyzed" ? analysis.features : null;
  const outcome: CandidateOutcome =
    analysis.status === "analyzed"
      ? `L${analysis.features.highestLevel}`
      : analysis.status;
  return {
    index,
    milliseconds: performance.now() - startedAt,
    outcome,
    difficulty:
      assessment.status === "classified" ? assessment.difficulty : null,
    symmetryKey,
    encodedSolution: encodeReflectionPoolSolution(problem.solution),
    pieceKindCount: analysis.scale.pieceKindCount,
    propagationRoundCount: features?.propagationRoundCount ?? 0,
    assumptionTestCount: features?.assumptionTestCount ?? 0,
  };
}

function runWorker(args: readonly string[]): void {
  const [size, pieceCount, start, count] = args.map(Number);
  const condition = {
    size: size as ReflectionBoardSize,
    pieceCount: pieceCount!,
  };
  const end = start! + count!;
  for (let index = start!; index < end; index += 1) {
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
      String(condition.size),
      String(condition.pieceCount),
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

/** 1つのワーカーに渡す候補数の上限。重い条件を細かく分け、ワーカーの手が空かないようにする。 */
const maximumBatchSize = 25;

async function runBatches(
  batches: readonly Batch[],
  jobs: number,
): Promise<void> {
  const queue = batches.flatMap((batch) =>
    Array.from(
      { length: Math.ceil(batch.count / maximumBatchSize) },
      (_, part): Batch => ({
        state: batch.state,
        start: batch.start + part * maximumBatchSize,
        count: Math.min(
          maximumBatchSize,
          batch.count - part * maximumBatchSize,
        ),
      }),
    ),
  );
  const pieces = [...queue];
  const results = new Map<Batch, Candidate[]>();
  await Promise.all(
    Array.from({ length: jobs }, async () => {
      for (let batch = queue.shift(); batch; batch = queue.shift()) {
        results.set(batch, await runBatch(batch));
      }
    }),
  );
  // 完了順ではなく候補番号の順に積む。
  for (const batch of pieces.sort((left, right) => left.start - right.start)) {
    batch.state.results.push(...results.get(batch)!);
  }
}

type SelectedCandidate = {
  condition: ReflectionGenerationConditions;
  candidate: Candidate;
};

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
 * 候補が上限まで尽きた条件は飛ばし、残りの条件で埋める。
 */
function selectLevel(
  difficulty: ReflectionDifficulty,
  states: readonly ConditionState[],
  perLevel: number,
  budget: number,
): LevelSelection | null {
  const queues = states.map((state) =>
    state.results
      .slice(0, budget)
      .filter((candidate) => candidate.difficulty === difficulty),
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
      if (seenKeys.has(candidate.symmetryKey)) {
        duplicateCount += 1;
        continue;
      }
      seenKeys.add(candidate.symmetryKey);
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

const distributionQuantiles = [
  ["min", 0],
  ["p25", 0.25],
  ["median", 0.5],
  ["p75", 0.75],
] as const;

function describeDistribution(values: readonly number[], digits = 0): string {
  const sorted = [...values].sort((left, right) => left - right);
  return [
    ...distributionQuantiles.map(
      ([label, ratio]) => `${label}=${quantile(sorted, ratio).toFixed(digits)}`,
    ),
    `max=${sorted.at(-1)!.toFixed(digits)}`,
  ].join(" ");
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
  levels: Record<ReflectionDifficulty, readonly ReflectionProblemPoolEntry[]>,
): string {
  const lines = reflectionDifficulties.map(
    ({ id }, levelIndex) =>
      `    ${JSON.stringify(id)}: [\n${levels[id]
        .map((entry) => `      ${JSON.stringify(entry)}`)
        .join(
          ",\n",
        )}\n    ]${levelIndex < reflectionDifficulties.length - 1 ? "," : ""}`,
  );
  return `{\n  "poolVersion": ${JSON.stringify(poolVersion)},\n  "generatorVersion": ${JSON.stringify(REFLECTION_GENERATOR_VERSION)},\n  "levels": {\n${lines.join("\n")}\n  }\n}\n`;
}

function describeSize(json: string): string {
  return `JSON ${json.length} bytes, gzip ${gzipSync(json).length} bytes`;
}

/** 問題集の1レベルの内訳（盤面×ピース数、ピースの種類の数、作業の量）。 */
function describeLevelEntries(
  difficulty: ReflectionDifficulty,
  entries: readonly ReflectionProblemPoolEntry[],
): string[] {
  const pooled = entries.map((entry, entryIndex) =>
    restoreReflectionPoolEntry(entry, {
      poolVersion,
      problemId: formatReflectionPoolProblemId(difficulty, entryIndex),
    }),
  );
  return [
    `  盤面×ピース数: ${formatCounts(pooled.map(({ identity }) => conditionKeyOf(identity.conditions)))}`,
    `  ピースの種類の数: ${formatCounts(pooled.map(({ problem }) => reflectionPieces.filter((piece) => problem.inventory[piece] > 0).length))}`,
    `  全外周ヒントへ照らし直した回数: ${describeDistribution(pooled.map(({ workload }) => workload.propagationRoundCount))}`,
    `  仮に置いて確かめた回数: ${describeDistribution(pooled.map(({ workload }) => workload.assumptionTestCount))}`,
  ];
}

async function runMain(): Promise<void> {
  const perLevel = readPositiveInteger("per-level", defaultPerLevel);
  const jobs = readPositiveInteger("jobs", 4);
  const block = readPositiveInteger("block", 100);
  const budget = readPositiveInteger("budget", 20_000);
  const startedAt = performance.now();

  const statesByKey = new Map<string, ConditionState>();
  const levelStates = Object.fromEntries(
    reflectionDifficulties.map(({ id }) => [
      id,
      listReflectionGenerationConditions(id).map((condition) => {
        const key = conditionKeyOf(condition);
        const state = statesByKey.get(key) ?? { condition, results: [] };
        statesByKey.set(key, state);
        return state;
      }),
    ]),
  ) as Record<ReflectionDifficulty, ConditionState[]>;

  const prefixLengths = Object.fromEntries(
    reflectionDifficulties.map(({ id }) => [id, 0]),
  ) as Record<ReflectionDifficulty, number>;
  const results = new Map<ReflectionDifficulty, LevelSelection>();

  for (;;) {
    const pending = reflectionDifficulties
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
      `${Math.round((performance.now() - startedAt) / 1000)}s ${reflectionDifficulties
        .map(
          ({ id }) =>
            `${id}:${results.has(id) ? "done" : `${prefixLengths[id]}/条件`}`,
        )
        .join(" ")}`,
    );
  }
  const wallSeconds = (performance.now() - startedAt) / 1000;

  const levels = {} as Record<
    ReflectionDifficulty,
    ReflectionProblemPoolEntry[]
  >;
  for (const { id: difficulty } of reflectionDifficulties) {
    levels[difficulty] = results
      .get(difficulty)!
      .selected.map(({ candidate }) => [
        candidate.index,
        candidate.encodedSolution,
        candidate.propagationRoundCount,
        candidate.assumptionTestCount,
      ]);
  }

  const report: string[] = [];
  for (const { id: difficulty } of reflectionDifficulties) {
    const { selected, duplicateCount, examinedLengths } =
      results.get(difficulty)!;
    const examined = levelStates[difficulty].flatMap((state) =>
      state.results.slice(0, examinedLengths.get(state)),
    );
    const classifiedCount = examined.filter(
      (candidate) => candidate.difficulty === difficulty,
    ).length;
    const cpuSeconds =
      examined.reduce((sum, candidate) => sum + candidate.milliseconds, 0) /
      1000;
    const selectedMilliseconds = selected.map(
      ({ candidate }) => candidate.milliseconds,
    );
    report.push(
      `## レベル ${difficulty}: ${selected.length}問`,
      `  候補 ${examined.length} / 分類一致 ${classifiedCount} (${((classifiedCount / examined.length) * 100).toFixed(1)}%) / 同型重複 ${duplicateCount} / 候補の計算 ${cpuSeconds.toFixed(1)}s (CPU)`,
      `  調べた候補の分析結果: ${formatCounts(examined.map((candidate) => candidate.outcome))}`,
      `  採った問題の生成＋分析時間 (ms): ${describeDistribution(selectedMilliseconds)}`,
      ...describeLevelEntries(difficulty, levels[difficulty]),
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
  difficulty: ReflectionDifficulty;
  index: number;
  reason: string;
};

function runVerifyWorker(args: readonly string[]): void {
  const [jobIndex, jobCount] = args.map(Number);
  for (const { id: difficulty } of reflectionDifficulties) {
    listReflectionPoolEntries(difficulty).forEach((entry, index) => {
      if (index % jobCount! !== jobIndex) {
        return;
      }
      function fail(reason: string): void {
        console.log(JSON.stringify({ difficulty, index, reason }));
      }
      const pooled = toReflectionPooledProblem(difficulty, index);
      const generated = generateReflectionProblem(pooled.identity);
      if (
        encodeReflectionPoolSolution(generated.problem.solution) !== entry[1]
      ) {
        fail("identity から再生成した問題が問題集と違う");
      }
      const analysis = analyzeReflectionDifficulty(pooled.problem);
      if (analysis.status !== "analyzed") {
        fail(
          `一意解で推論レベル5までに解き切れない (${analysis.status}${analysis.status === "invalid" ? `: ${analysis.reason}` : ""})`,
        );
        return;
      }
      const { propagationRoundCount, assumptionTestCount } = analysis.features;
      if (
        pooled.workload.propagationRoundCount !== propagationRoundCount ||
        pooled.workload.assumptionTestCount !== assumptionTestCount
      ) {
        fail(
          `作業の量が分析と違う (照らし直し ${pooled.workload.propagationRoundCount}/${propagationRoundCount}, 仮置き ${pooled.workload.assumptionTestCount}/${assumptionTestCount})`,
        );
      }
      const assessment = assessReflectionDifficulty(analysis);
      if (
        assessment.status !== "classified" ||
        assessment.difficulty !== difficulty
      ) {
        fail(`レベルが一致しない (${JSON.stringify(assessment)})`);
      }
    });
  }
}

function measureSelection(): string {
  const durations: number[] = [];
  for (const { id: difficulty } of reflectionDifficulties) {
    for (let index = 0; index < 2000; index += 1) {
      const startedAt = performance.now();
      selectReflectionProblemForDifficulty(difficulty, `measure-${index}`);
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

  // 同型の重複と seed の重複は、レベルをまたいで確かめる。
  const keys = new Set<string>();
  const seeds = new Set<string>();
  let duplicateCount = 0;
  let total = 0;
  const levels = {} as Record<
    ReflectionDifficulty,
    ReflectionProblemPoolEntry[]
  >;
  for (const { id: difficulty } of reflectionDifficulties) {
    levels[difficulty] = [...listReflectionPoolEntries(difficulty)];
    for (const entry of levels[difficulty]) {
      total += 1;
      const key = getReflectionSymmetryKey(
        decodeReflectionPoolSolution(entry[1]),
      );
      const { seed } = toReflectionPoolIdentity(entry);
      if (keys.has(key) || seeds.has(seed)) {
        duplicateCount += 1;
      }
      keys.add(key);
      seeds.add(seed);
    }
  }

  console.log(
    `${total}問を検証 (${((performance.now() - startedAt) / 1000).toFixed(1)}s, jobs=${jobs}): 不合格 ${failures.length} / 同型・seed の重複 ${duplicateCount}`,
  );
  for (const failure of failures) {
    console.log(
      `  レベル ${failure.difficulty} の ${failure.index + 1}番: ${failure.reason}`,
    );
  }
  for (const { id: difficulty } of reflectionDifficulties) {
    console.log(
      [
        `レベル ${difficulty}: ${levels[difficulty].length}問`,
        ...describeLevelEntries(difficulty, levels[difficulty]),
      ].join("\n"),
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
