import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { difficultyLevels } from "@/games/difficulty";
import {
  assessHamiltonianPathDifficulty,
  type HamiltonianPathDifficulty,
  listHamiltonianPathGenerationConditions,
} from "@/games/hamiltonian-path/difficulty";
import {
  analyzeHamiltonianPathDifficulty,
  getHamiltonianPathSolveWorkload,
} from "@/games/hamiltonian-path/problem/difficulty-analysis";
import { measureHamiltonianPathStraightRatio } from "@/games/hamiltonian-path/problem/generation/straightness";
import { getHamiltonianPathSymmetryKey } from "@/games/hamiltonian-path/problem/generation/symmetry";
import { generateHamiltonianPathProblem } from "@/games/hamiltonian-path/problem/generator";
import {
  createHamiltonianPathProblemIdentity,
  HAMILTONIAN_PATH_GENERATOR_VERSION,
  type HamiltonianPathBoardSize,
  type HamiltonianPathGenerationConditions,
  type HamiltonianPathSolveWorkload,
  type HamiltonianPathWallRatio,
} from "@/games/hamiltonian-path/problem/problem";
import {
  encodeHamiltonianPathPoolObstacles,
  type HamiltonianPathProblemPoolEntry,
  listHamiltonianPathPoolEntries,
  toHamiltonianPathPooledProblem,
} from "@/games/hamiltonian-path/problem/problem-pool";
import { selectHamiltonianPathProblemForDifficulty } from "@/games/hamiltonian-path/problem-selection";

const defaultPerLevel = 500;

/**
 * レベルごとに候補を作る生成条件。並びは採用率の高い順。
 * レベルの盤面サイズの範囲にある条件のうち、採用率の低い条件（例: レベル4 の 7×7・壁率0.15 は 0.5%）を除き、
 * 候補の計算をそのレベルに分類されやすい条件へ寄せる（`docs/パズル/導入調査/ハミルトン路/ハミルトン路難易度.md` §9）。
 * 条件を巡回して1問ずつ採るので、レベルの中の盤面サイズ・壁率の混ざり方もこの一覧で決まる。
 */
const poolConditionsByDifficulty = {
  "1": [
    { size: 5, wallRatio: 0 },
    { size: 5, wallRatio: 0.15 },
    { size: 6, wallRatio: 0.15 },
  ],
  "2": [
    { size: 6, wallRatio: 0 },
    { size: 7, wallRatio: 0 },
    { size: 7, wallRatio: 0.15 },
  ],
  "3": [
    { size: 7, wallRatio: 0 },
    { size: 8, wallRatio: 0 },
  ],
  "4": [
    { size: 8, wallRatio: 0 },
    { size: 7, wallRatio: 0 },
  ],
  "5": [{ size: 8, wallRatio: 0 }],
} as const satisfies Record<
  HamiltonianPathDifficulty,
  readonly HamiltonianPathGenerationConditions[]
>;

/** 解の道の直進率がこれ以上の問題を、蛇行するだけの単調な道とみなす。研究用 Python の実験の目安と同じ値。 */
const MONOTONOUS_STRAIGHT_RATIO = 0.6;

/**
 * 各レベルで単調な道の問題が占めてよい割合の上限。問題集の先頭から数えたどの範囲でも超えないように採る。
 * 単調な道は候補のどのレベルにも 15〜30% あり、上位のレベルほど多い。除き切ると上位レベルの供給を削り、
 * 直進区間が読みの一部になっている問題まで落とすので、割合を抑えるだけにする。
 */
const MAXIMUM_MONOTONOUS_SHARE = 0.1;

const usage = `Usage: bun run generate:hamiltonian-path-pool -- [options]

レベルごとに、採用率の高い生成条件（盤面サイズ×壁率）で、決定的な seed の候補を番号順に生成・分析する。
そのレベルに分類された候補を、回転・反転（8通り）の同型の重複をレベルをまたいで除き、直進率 ${MONOTONOUS_STRAIGHT_RATIO} 以上の
単調な道を ${MAXIMUM_MONOTONOUS_SHARE * 100}% 以下に抑えながら、生成条件を巡回して問題集へ採る。

Options:
  --per-level <n>  レベルごとの問題数 (default: ${defaultPerLevel})
  --jobs <n>       並列ワーカー数 (default: 4)
  --block <n>      生成条件ごとに一度に増やす候補数 (default: 400)
  --budget <n>     生成条件ごとに調べる候補数の上限 (default: 30000)
  --verify         生成せず、同梱の問題集の全問を identity から再生成→一意性確認→分析→分類し、
                   盤面・作業の量・直進率の割合・同型と seed の重複・JSON の大きさ・選択時間を確かめる`;

const outputPath = new URL(
  "../src/games/hamiltonian-path/problem/problem-pool.json",
  import.meta.url,
);

type Candidate = {
  index: number;
  milliseconds: number;
  /** 分類できたらレベル、できなければ分類の状態か提供範囲外の理由。 */
  outcome: string;
  difficulty: HamiltonianPathDifficulty | null;
  symmetryKey: string;
  start: number;
  encodedObstacles: string;
  straightRatio: number;
  workload: HamiltonianPathSolveWorkload | null;
};

type ConditionState = {
  condition: HamiltonianPathGenerationConditions;
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
  wallRatio,
}: HamiltonianPathGenerationConditions): string {
  return `${size}×${size}/${wallRatio}`;
}

function isMonotonous(straightRatio: number): boolean {
  return straightRatio >= MONOTONOUS_STRAIGHT_RATIO;
}

function evaluateCandidate(
  condition: HamiltonianPathGenerationConditions,
  index: number,
): Candidate {
  const startedAt = performance.now();
  const { problem, solution, symmetryKey } = generateHamiltonianPathProblem(
    createHamiltonianPathProblemIdentity(
      condition.size,
      condition.wallRatio,
      index,
    ),
  );
  const analysis = analyzeHamiltonianPathDifficulty(problem);
  const assessment = assessHamiltonianPathDifficulty(analysis);
  return {
    index,
    milliseconds: performance.now() - startedAt,
    outcome:
      assessment.status === "classified"
        ? `L${assessment.difficulty}`
        : assessment.status === "out-of-range"
          ? assessment.reason
          : assessment.status,
    difficulty:
      assessment.status === "classified" ? assessment.difficulty : null,
    symmetryKey,
    start: problem.start,
    encodedObstacles: encodeHamiltonianPathPoolObstacles(problem),
    straightRatio: measureHamiltonianPathStraightRatio(solution),
    workload:
      analysis.status === "analyzed"
        ? getHamiltonianPathSolveWorkload(analysis)
        : null,
  };
}

function runWorker(args: readonly string[]): void {
  const [size, wallRatio, start, count] = args.map(Number);
  const condition = {
    size: size as HamiltonianPathBoardSize,
    wallRatio: wallRatio as HamiltonianPathWallRatio,
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
      String(condition.wallRatio),
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
const maximumBatchSize = 50;

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
  condition: HamiltonianPathGenerationConditions;
  candidate: Candidate;
};

type LevelSelection = {
  selected: SelectedCandidate[];
  duplicateCount: number;
  /** 単調な道の割合を抑えるために採らなかった候補の数。 */
  monotonousSkipCount: number;
  /** 生成条件ごとの、採る問題を決めるまでに調べた候補数。 */
  examinedLengths: Map<ConditionState, number>;
};

/**
 * 単調な道の問題を、問題集の先頭から数えたどの範囲でも上限の割合を超えないときだけ採れる。
 * 割合を問題数の全体ではなく先頭からの範囲で抑えるので、採る問題は `--per-level` に依らない。
 */
function canTakeMonotonous(
  monotonousCount: number,
  selectedCount: number,
): boolean {
  return monotonousCount + 1 <= MAXIMUM_MONOTONOUS_SHARE * (selectedCount + 1);
}

/**
 * 生成条件を巡回し、各条件の採れる候補を番号順に1つずつ採る。同型の重複（下のレベルで採った問題との重複を含む）と、
 * 割合の上限を超える単調な道は飛ばす。
 * 採る問題は各条件の候補の番号順の並びと下のレベルで採った問題だけで決まり、ワーカー数や一度に調べる候補数に依存しない。
 * 巡回がまだ調べていない候補に届いたら、候補を増やす必要があるので `null` を返す。
 * 候補が上限まで尽きた条件は飛ばし、残りの条件で埋める。
 */
function selectLevel(
  difficulty: HamiltonianPathDifficulty,
  states: readonly ConditionState[],
  perLevel: number,
  budget: number,
  lowerLevelKeys: ReadonlySet<string>,
): LevelSelection | null {
  const queues = states.map((state) =>
    state.results
      .slice(0, budget)
      .filter((candidate) => candidate.difficulty === difficulty),
  );
  const cursors = states.map(() => 0);
  const selected: SelectedCandidate[] = [];
  const examinedLengths = new Map<ConditionState, number>(
    states.map((state) => [state, 0]),
  );
  const seenKeys = new Set(lowerLevelKeys);
  let duplicateCount = 0;
  let monotonousCount = 0;
  let monotonousSkipCount = 0;
  while (selected.length < perLevel) {
    let hasCandidate = false;
    for (const [conditionIndex, state] of states.entries()) {
      if (selected.length >= perLevel) {
        break;
      }
      // 1巡で各条件から1問を採る。採れない候補（重複・単調）は飛ばして、同じ条件の次の候補を見る。
      for (;;) {
        const candidate = queues[conditionIndex]![cursors[conditionIndex]!];
        if (!candidate) {
          if (state.results.length < budget) {
            return null;
          }
          break;
        }
        hasCandidate = true;
        cursors[conditionIndex]! += 1;
        examinedLengths.set(state, candidate.index + 1);
        if (seenKeys.has(candidate.symmetryKey)) {
          duplicateCount += 1;
          continue;
        }
        const monotonous = isMonotonous(candidate.straightRatio);
        if (
          monotonous &&
          !canTakeMonotonous(monotonousCount, selected.length)
        ) {
          monotonousSkipCount += 1;
          continue;
        }
        seenKeys.add(candidate.symmetryKey);
        monotonousCount += monotonous ? 1 : 0;
        selected.push({ condition: state.condition, candidate });
        break;
      }
    }
    if (!hasCandidate) {
      throw new Error(
        `Level ${difficulty} could not reach ${perLevel} problems within ${budget} candidates per condition`,
      );
    }
  }
  return { selected, duplicateCount, monotonousSkipCount, examinedLengths };
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
  ["p90", 0.9],
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

function toPoolEntry({
  condition,
  candidate,
}: SelectedCandidate): HamiltonianPathProblemPoolEntry {
  const workload = candidate.workload!;
  return [
    condition.size,
    Math.round(condition.wallRatio * 100),
    candidate.index,
    candidate.start,
    candidate.encodedObstacles,
    workload.assumptionCount,
    workload.refutationStepCount,
    workload.longestRefutationLength,
    workload.fatalBranchCount,
  ];
}

function formatPoolJson(
  levels: Record<
    HamiltonianPathDifficulty,
    readonly HamiltonianPathProblemPoolEntry[]
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
  return `{\n  "generatorVersion": ${JSON.stringify(HAMILTONIAN_PATH_GENERATOR_VERSION)},\n  "levels": {\n${lines.join("\n")}\n  }\n}\n`;
}

function describeSize(json: string): string {
  return `JSON ${json.length} bytes, gzip ${gzipSync(json).length} bytes`;
}

/** 問題集の1レベルの内訳（生成条件、盤面の規模、作業の量、直進率）。 */
function describeLevelEntries(
  entries: readonly HamiltonianPathProblemPoolEntry[],
  straightRatios: readonly number[],
): string[] {
  const pooled = entries.map(toHamiltonianPathPooledProblem);
  return [
    `  盤面/壁率: ${formatCounts(pooled.map(({ identity }) => conditionKeyOf(identity.conditions)))}`,
    `  有効マス: ${describeDistribution(pooled.map(({ workload }) => workload.openCellCount))}`,
    `  仕切り: ${describeDistribution(pooled.map(({ problem }) => problem.partitions.length))}`,
    `  仮置きの回数: ${describeDistribution(pooled.map(({ workload }) => workload.assumptionCount))}`,
    `  先読みの手数の合計: ${describeDistribution(pooled.map(({ workload }) => workload.refutationStepCount))}`,
    `  最も長い先読み: ${describeDistribution(pooled.map(({ workload }) => workload.longestRefutationLength))}`,
    `  迷う分岐: ${describeDistribution(pooled.map(({ workload }) => workload.fatalBranchCount))}`,
    `  直進率: ${describeDistribution(straightRatios, 2)} / ${MONOTONOUS_STRAIGHT_RATIO}以上 ${straightRatios.filter(isMonotonous).length}問`,
  ];
}

function assertPoolConditions(): void {
  for (const { id } of difficultyLevels) {
    const levelConditions =
      listHamiltonianPathGenerationConditions(id).map(conditionKeyOf);
    for (const condition of poolConditionsByDifficulty[id]) {
      if (!levelConditions.includes(conditionKeyOf(condition))) {
        throw new RangeError(
          `Level ${id} cannot use ${conditionKeyOf(condition)}`,
        );
      }
    }
  }
}

async function runMain(): Promise<void> {
  assertPoolConditions();
  const perLevel = readPositiveInteger("per-level", defaultPerLevel);
  const jobs = readPositiveInteger("jobs", 4);
  const block = readPositiveInteger("block", 400);
  const budget = readPositiveInteger("budget", 30_000);
  const startedAt = performance.now();

  const statesByKey = new Map<string, ConditionState>();
  const levelStates = Object.fromEntries(
    difficultyLevels.map(({ id }) => [
      id,
      poolConditionsByDifficulty[id].map((condition) => {
        const key = conditionKeyOf(condition);
        const state = statesByKey.get(key) ?? { condition, results: [] };
        statesByKey.set(key, state);
        return state;
      }),
    ]),
  ) as Record<HamiltonianPathDifficulty, ConditionState[]>;

  const prefixLengths = Object.fromEntries(
    difficultyLevels.map(({ id }) => [id, 0]),
  ) as Record<HamiltonianPathDifficulty, number>;
  const results = new Map<HamiltonianPathDifficulty, LevelSelection>();

  for (;;) {
    const pending = difficultyLevels
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
    // 同型の重複はレベルをまたいで除くので、下のレベルから順に、下のレベルが決まってから採る。
    for (const { id: difficulty } of difficultyLevels) {
      if (results.has(difficulty)) {
        continue;
      }
      const selection = selectLevel(
        difficulty,
        levelStates[difficulty],
        perLevel,
        budget,
        new Set(
          [...results.values()].flatMap(({ selected }) =>
            selected.map(({ candidate }) => candidate.symmetryKey),
          ),
        ),
      );
      if (!selection) {
        break;
      }
      results.set(difficulty, selection);
    }
    console.error(
      `${Math.round((performance.now() - startedAt) / 1000)}s ${difficultyLevels
        .map(
          ({ id }) =>
            `${id}:${results.has(id) ? "done" : `${prefixLengths[id]}/条件`}`,
        )
        .join(" ")}`,
    );
  }
  const wallSeconds = (performance.now() - startedAt) / 1000;

  const levels = {} as Record<
    HamiltonianPathDifficulty,
    HamiltonianPathProblemPoolEntry[]
  >;
  const report: string[] = [];
  for (const { id: difficulty } of difficultyLevels) {
    const { selected, duplicateCount, monotonousSkipCount, examinedLengths } =
      results.get(difficulty)!;
    levels[difficulty] = selected.map(toPoolEntry);
    const examined = levelStates[difficulty].flatMap((state) =>
      state.results.slice(0, examinedLengths.get(state)),
    );
    const classifiedCount = examined.filter(
      (candidate) => candidate.difficulty === difficulty,
    ).length;
    const cpuSeconds =
      examined.reduce((sum, candidate) => sum + candidate.milliseconds, 0) /
      1000;
    report.push(
      `## レベル ${difficulty}: ${selected.length}問`,
      `  候補 ${examined.length} / 分類一致 ${classifiedCount} (${((classifiedCount / examined.length) * 100).toFixed(1)}%) / 同型重複 ${duplicateCount} / 単調で見送り ${monotonousSkipCount} / 候補の計算 ${cpuSeconds.toFixed(1)}s (CPU)`,
      `  調べた候補の分析結果: ${formatCounts(examined.map((candidate) => candidate.outcome))}`,
      `  分類一致した候補の直進率 ${MONOTONOUS_STRAIGHT_RATIO}以上: ${examined.filter((candidate) => candidate.difficulty === difficulty && isMonotonous(candidate.straightRatio)).length} / ${classifiedCount}`,
      `  採った問題の生成＋分析時間 (ms): ${describeDistribution(selected.map(({ candidate }) => candidate.milliseconds))}`,
      ...describeLevelEntries(
        levels[difficulty],
        selected.map(({ candidate }) => candidate.straightRatio),
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

type VerifyResult = {
  difficulty: HamiltonianPathDifficulty;
  index: number;
  straightRatio: number;
  failures: string[];
};

function verifyEntry(
  difficulty: HamiltonianPathDifficulty,
  index: number,
  entry: HamiltonianPathProblemPoolEntry,
): VerifyResult {
  const failures: string[] = [];
  const pooled = toHamiltonianPathPooledProblem(entry);
  const generated = generateHamiltonianPathProblem(pooled.identity);
  if (
    generated.problem.start !== entry[3] ||
    encodeHamiltonianPathPoolObstacles(generated.problem) !== entry[4]
  ) {
    failures.push("identity から再生成した問題が問題集と違う");
  }
  const analysis = analyzeHamiltonianPathDifficulty(pooled.problem);
  if (analysis.status !== "analyzed") {
    failures.push(
      `一意解で解法器が解き切れない (${analysis.status}: ${analysis.reason})`,
    );
  } else {
    const workload = getHamiltonianPathSolveWorkload(analysis);
    if (JSON.stringify(workload) !== JSON.stringify(pooled.workload)) {
      failures.push(
        `作業の量が分析と違う (問題集 ${JSON.stringify(pooled.workload)} / 分析 ${JSON.stringify(workload)})`,
      );
    }
    const assessment = assessHamiltonianPathDifficulty(analysis);
    if (
      assessment.status !== "classified" ||
      assessment.difficulty !== difficulty
    ) {
      failures.push(`レベルが一致しない (${JSON.stringify(assessment)})`);
    }
  }
  return {
    difficulty,
    index,
    straightRatio: measureHamiltonianPathStraightRatio(generated.solution),
    failures,
  };
}

function runVerifyWorker(args: readonly string[]): void {
  const [jobIndex, jobCount] = args.map(Number);
  let position = 0;
  for (const { id: difficulty } of difficultyLevels) {
    listHamiltonianPathPoolEntries(difficulty).forEach((entry, index) => {
      if (position++ % jobCount! === jobIndex) {
        console.log(JSON.stringify(verifyEntry(difficulty, index, entry)));
      }
    });
  }
}

function measureSelection(): string {
  const durations: number[] = [];
  for (const { id: difficulty } of difficultyLevels) {
    for (let index = 0; index < 2000; index += 1) {
      const startedAt = performance.now();
      selectHamiltonianPathProblemForDifficulty(difficulty, `measure-${index}`);
      durations.push(performance.now() - startedAt);
    }
  }
  durations.sort((left, right) => left - right);
  const mean =
    durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
  return `選択+復元 ${durations.length}回: mean=${mean.toFixed(3)}ms p99=${quantile(durations, 0.99).toFixed(3)}ms max=${durations.at(-1)!.toFixed(3)}ms`;
}

/** 先頭から数えたどの範囲でも、単調な道の割合が上限を超えていないか。 */
function keepsMonotonousShare(straightRatios: readonly number[]): boolean {
  let monotonousCount = 0;
  return straightRatios.every((straightRatio, index) => {
    monotonousCount += isMonotonous(straightRatio) ? 1 : 0;
    return monotonousCount <= MAXIMUM_MONOTONOUS_SHARE * (index + 1);
  });
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
  const verified = outputs
    .join("\n")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as VerifyResult);
  const failures = verified.filter((result) => result.failures.length > 0);

  // 同型の重複と seed の重複は、レベルをまたいで確かめる。
  const keys = new Set<string>();
  const seeds = new Set<string>();
  let duplicateCount = 0;
  let total = 0;
  const levels = {} as Record<
    HamiltonianPathDifficulty,
    HamiltonianPathProblemPoolEntry[]
  >;
  const unbalancedLevels: HamiltonianPathDifficulty[] = [];
  const report: string[] = [];
  for (const { id: difficulty } of difficultyLevels) {
    levels[difficulty] = [...listHamiltonianPathPoolEntries(difficulty)];
    for (const entry of levels[difficulty]) {
      total += 1;
      const { problem, identity } = toHamiltonianPathPooledProblem(entry);
      const key = getHamiltonianPathSymmetryKey(problem);
      if (keys.has(key) || seeds.has(identity.seed)) {
        duplicateCount += 1;
      }
      keys.add(key);
      seeds.add(identity.seed);
    }
    const straightRatios = verified
      .filter((result) => result.difficulty === difficulty)
      .sort((left, right) => left.index - right.index)
      .map(({ straightRatio }) => straightRatio);
    if (!keepsMonotonousShare(straightRatios)) {
      unbalancedLevels.push(difficulty);
    }
    report.push(
      `レベル ${difficulty}: ${levels[difficulty].length}問`,
      ...describeLevelEntries(levels[difficulty], straightRatios),
    );
  }

  console.log(
    `${total}問を検証 (${((performance.now() - startedAt) / 1000).toFixed(1)}s, jobs=${jobs}): 不合格 ${failures.length} / 同型・seed の重複 ${duplicateCount} / 単調な道の割合が上限を超えたレベル ${unbalancedLevels.length}`,
  );
  for (const failure of failures) {
    console.log(
      `  レベル ${failure.difficulty} の ${failure.index + 1}番: ${failure.failures.join(" / ")}`,
    );
  }
  for (const difficulty of unbalancedLevels) {
    console.log(
      `  レベル ${difficulty}: 直進率 ${MONOTONOUS_STRAIGHT_RATIO} 以上の問題が ${MAXIMUM_MONOTONOUS_SHARE * 100}% を超える範囲がある`,
    );
  }
  console.log(report.join("\n"));
  console.log(describeSize(formatPoolJson(levels)));
  console.log(measureSelection());
  if (
    failures.length > 0 ||
    duplicateCount > 0 ||
    unbalancedLevels.length > 0 ||
    verified.length !== total
  ) {
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
