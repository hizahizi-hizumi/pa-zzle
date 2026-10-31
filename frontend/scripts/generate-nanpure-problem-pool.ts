import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { difficultyLevels } from "@/games/difficulty";
import {
  assessNanpureDifficulty,
  type NanpureDifficulty,
} from "@/games/nanpure/difficulty";
import { generateNanpureProblem } from "@/games/nanpure/problem/generator";
import {
  createNanpureProblemIdentity,
  NANPURE_GENERATOR_VERSION,
} from "@/games/nanpure/problem/problem";
import {
  decodeNanpurePoolProblem,
  encodeNanpurePoolProblem,
  listNanpurePoolEntries,
  type NanpureProblemPoolEntry,
  toNanpurePoolIdentity,
} from "@/games/nanpure/problem/problem-pool";
import type { NanpureTechnique } from "@/games/nanpure/problem/technique";
import { selectNanpureProblemForDifficulty } from "@/games/nanpure/problem-selection";

const defaultPerLevel = 300;

const usage = `Usage: bun run generate:nanpure-pool -- [options]

難易度ごとに決めた生成条件（ヒントを減らすときの手筋の上限）で、決定的な seed の候補を番号順に生成・分析する。
その難易度に分類され、ヒント数が共通の範囲に入る候補を、同じ問題の重複を除きながら生成条件を巡回して問題集へ採る。

Options:
  --per-level <n>  難易度ごとの問題数 (default: ${defaultPerLevel})
  --jobs <n>       並列ワーカー数 (default: 4)
  --block <n>      生成条件ごとに一度に増やす候補数 (default: 200)
  --budget <n>     生成条件ごとに調べる候補数の上限 (default: 20000)
  --verify         生成せず、同梱の問題集の全問を identity から再生成→分析→分類し、重複・JSON の大きさ・選択時間を確かめる`;

const outputPath = new URL(
  "../src/games/nanpure/problem/problem-pool.json",
  import.meta.url,
);

/**
 * 問題集に採るヒント数の範囲。全難易度で共通にする。
 * ヒント数（埋める作業の量）でレベルが決まらないよう、どのレベルも同じ範囲から採る。
 * 範囲は、各レベルのヒント数の分布が重なる帯（ナンプレ5段階難易度.md §7.3）から決めた。
 */
const clueCountRange = { minimum: 23, maximum: 27 } as const;

type RemovalLimit = NanpureTechnique | null;

/**
 * 難易度ごとに、その難易度が現れやすい生成条件（ナンプレ5段階難易度.md §7.1）。
 * 生成条件は候補を作る領域を決めるだけで、採るかどうかは分析・分類の結果で決める。
 */
const levelConditions: Record<NanpureDifficulty, readonly RemovalLimit[]> = {
  "1": ["hidden-single-block"],
  "2": ["hidden-single-line", "naked-single"],
  "3": ["locked-candidates"],
  "4": ["hidden-triple", null],
  "5": ["xyz-wing", null],
};

type Candidate = {
  index: number;
  milliseconds: number;
  /** 分類できた候補の難易度。提供範囲外・評価不能は `null`。 */
  difficulty: NanpureDifficulty | null;
  clueCount: number;
  encodedProblem: string;
  deepestTechnique: NanpureTechnique | null;
  roundCount: number | null;
  eliminationRoundCount: number | null;
};

type ConditionState = {
  removalLimit: RemovalLimit;
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

function conditionKeyOf(removalLimit: RemovalLimit): string {
  return removalLimit ?? "uniqueness";
}

function countClues(encodedProblem: string): number {
  return decodeNanpurePoolProblem(encodedProblem).clues.filter(
    (cell) => cell !== null,
  ).length;
}

function evaluateCandidate(
  removalLimit: RemovalLimit,
  index: number,
): Candidate {
  const startedAt = performance.now();
  const { problem, difficultyAnalysis } = generateNanpureProblem(
    createNanpureProblemIdentity(removalLimit, index),
  );
  const assessment = assessNanpureDifficulty(difficultyAnalysis);
  const features =
    difficultyAnalysis.status === "analyzed"
      ? difficultyAnalysis.features
      : null;
  return {
    index,
    milliseconds: performance.now() - startedAt,
    difficulty:
      assessment.status === "classified" ? assessment.difficulty : null,
    clueCount: difficultyAnalysis.scale.clueCount,
    encodedProblem: encodeNanpurePoolProblem(problem),
    deepestTechnique: features?.deepestTechnique ?? null,
    roundCount: features?.roundCount ?? null,
    eliminationRoundCount: features?.eliminationRoundCount ?? null,
  };
}

function runWorker(args: readonly string[]): void {
  const [removalLimit, start, count] = args;
  const limit =
    removalLimit === "uniqueness" ? null : (removalLimit as NanpureTechnique);
  const end = Number(start) + Number(count);
  for (let index = Number(start); index < end; index += 1) {
    console.log(JSON.stringify(evaluateCandidate(limit, index)));
  }
}

type Batch = { state: ConditionState; start: number; count: number };

async function runBatch({ state, start, count }: Batch): Promise<Candidate[]> {
  const worker = Bun.spawn(
    [
      process.execPath,
      Bun.fileURLToPath(import.meta.url),
      "--worker",
      conditionKeyOf(state.removalLimit),
      String(start),
      String(count),
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  const output = await new Response(worker.stdout).text();
  if ((await worker.exited) !== 0) {
    throw new Error(`Worker failed for ${conditionKeyOf(state.removalLimit)}`);
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

type SelectedCandidate = { removalLimit: RemovalLimit; candidate: Candidate };

function isEligible(
  candidate: Candidate,
  difficulty: NanpureDifficulty,
): boolean {
  return (
    candidate.difficulty === difficulty &&
    candidate.clueCount >= clueCountRange.minimum &&
    candidate.clueCount <= clueCountRange.maximum
  );
}

type LevelSelection = {
  selected: SelectedCandidate[];
  duplicateCount: number;
  /** 生成条件ごとの、採る問題を決めるまでに調べた候補数。 */
  examinedLengths: Map<ConditionState, number>;
};

/**
 * 生成条件を巡回し、各条件の採れる候補を番号順に1つずつ採る。同じ問題の重複は飛ばす。
 * 採る問題は各条件の候補の番号順の並びだけで決まり、ワーカー数や一度に調べる候補数に依存しない。
 * 巡回がまだ調べていない候補に届いたら、候補を増やす必要があるので `null` を返す。
 * 他のレベルが採った問題は、分類が違うので重ならない。
 */
function selectLevel(
  difficulty: NanpureDifficulty,
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
  const seenProblems = new Set<string>();
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
      if (seenProblems.has(candidate.encodedProblem)) {
        duplicateCount += 1;
        continue;
      }
      seenProblems.add(candidate.encodedProblem);
      selected.push({ removalLimit: state.removalLimit, candidate });
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
  levels: Record<NanpureDifficulty, NanpureProblemPoolEntry[]>,
): string {
  const lines = difficultyLevels.map(
    ({ id }, levelIndex) =>
      `    ${JSON.stringify(id)}: [\n${levels[id]
        .map((entry) => `      ${JSON.stringify(entry)}`)
        .join(
          ",\n",
        )}\n    ]${levelIndex < difficultyLevels.length - 1 ? "," : ""}`,
  );
  return `{\n  "generatorVersion": ${JSON.stringify(NANPURE_GENERATOR_VERSION)},\n  "levels": {\n${lines.join("\n")}\n  }\n}\n`;
}

function describeSize(json: string): string {
  return `JSON ${json.length} bytes, gzip ${gzipSync(json).length} bytes`;
}

async function runMain(): Promise<void> {
  const perLevel = readPositiveInteger("per-level", defaultPerLevel);
  const jobs = readPositiveInteger("jobs", 4);
  const block = readPositiveInteger("block", 200);
  const budget = readPositiveInteger("budget", 20_000);
  const startedAt = performance.now();

  const statesByKey = new Map<string, ConditionState>();
  const levelStates = Object.fromEntries(
    difficultyLevels.map(({ id }) => [
      id,
      levelConditions[id].map((removalLimit) => {
        const key = conditionKeyOf(removalLimit);
        const state = statesByKey.get(key) ?? { removalLimit, results: [] };
        statesByKey.set(key, state);
        return state;
      }),
    ]),
  ) as Record<NanpureDifficulty, ConditionState[]>;

  const prefixLengths = Object.fromEntries(
    difficultyLevels.map(({ id }) => [id, 0]),
  ) as Record<NanpureDifficulty, number>;
  const results = new Map<NanpureDifficulty, LevelSelection>();

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
    // ワーカーへ小分けにして、並列数だけ同時に計算する。
    const batches: Batch[] = [...requiredLengths].flatMap(([state, length]) => {
      const start = state.results.length;
      const count = length - start;
      const chunk = Math.max(1, Math.ceil(count / jobs));
      return Array.from(
        { length: Math.ceil(count / chunk) },
        (_, chunkIndex) => ({
          state,
          start: start + chunkIndex * chunk,
          count: Math.min(chunk, count - chunkIndex * chunk),
        }),
      );
    });
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
      `${Math.round((performance.now() - startedAt) / 1000)}s ${difficultyLevels
        .map(
          ({ id }) =>
            `${id}:${results.has(id) ? "done" : `${prefixLengths[id]}/条件`}`,
        )
        .join(" ")}`,
    );
  }
  const wallSeconds = (performance.now() - startedAt) / 1000;

  const levels = {} as Record<NanpureDifficulty, NanpureProblemPoolEntry[]>;
  const report: string[] = [];
  for (const { id: difficulty } of difficultyLevels) {
    const { selected, duplicateCount, examinedLengths } =
      results.get(difficulty)!;
    levels[difficulty] = selected.map(({ removalLimit, candidate }) => [
      removalLimit,
      candidate.index,
      candidate.encodedProblem,
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
    const candidates = selected.map(({ candidate }) => candidate);
    function percentage(count: number): string {
      return `${((count / examined.length) * 100).toFixed(1)}%`;
    }
    report.push(
      `## 難易度 ${difficulty}: ${selected.length}問`,
      `  候補 ${examined.length} / 分類一致 ${classifiedCount} (${percentage(classifiedCount)}) / ヒント数の範囲内 ${eligibleCount} (${percentage(eligibleCount)}) / 重複 ${duplicateCount} / 候補の計算 ${cpuSeconds.toFixed(1)}s (CPU) / 1問あたり ${((cpuSeconds / selected.length) * 1000).toFixed(0)}ms`,
      `  生成条件: ${formatCounts(selected.map(({ removalLimit }) => conditionKeyOf(removalLimit)))}`,
      `  最も深い手筋: ${formatCounts(candidates.map((candidate) => candidate.deepestTechnique ?? "none"))}`,
      `  ヒント数: ${formatCounts(candidates.map((candidate) => candidate.clueCount))}`,
      `  分類一致した候補のヒント数の分布（範囲で絞る前）: ${describeDistribution(examined.filter((candidate) => candidate.difficulty === difficulty).map((candidate) => candidate.clueCount))}`,
      `  ラウンド数: ${describeDistribution(candidates.map((candidate) => candidate.roundCount ?? 0))}`,
      `  候補を消す手筋が要ったラウンド数: ${describeDistribution(candidates.map((candidate) => candidate.eliminationRoundCount ?? 0))}`,
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
  difficulty: NanpureDifficulty;
  index: number;
  reason: string;
};

function runVerifyWorker(args: readonly string[]): void {
  const [jobIndex, jobCount] = args.map(Number);
  for (const { id: difficulty } of difficultyLevels) {
    listNanpurePoolEntries(difficulty).forEach((entry, index) => {
      if (index % jobCount! !== jobIndex) {
        return;
      }
      function fail(reason: string): void {
        console.log(JSON.stringify({ difficulty, index, reason }));
      }
      const { problem, difficultyAnalysis } = generateNanpureProblem(
        toNanpurePoolIdentity(entry),
      );
      if (encodeNanpurePoolProblem(problem) !== entry[2]) {
        fail("identity から再生成した問題が問題集と違う");
      }
      if (difficultyAnalysis.status !== "analyzed") {
        fail(`一意解で手筋で解き切れない (${difficultyAnalysis.status})`);
        return;
      }
      const assessment = assessNanpureDifficulty(difficultyAnalysis);
      if (
        assessment.status !== "classified" ||
        assessment.difficulty !== difficulty
      ) {
        fail(`難易度が一致しない (${JSON.stringify(assessment)})`);
      }
      const clueCount = countClues(entry[2]);
      if (
        clueCount < clueCountRange.minimum ||
        clueCount > clueCountRange.maximum
      ) {
        fail(`ヒント数が範囲外 (${clueCount})`);
      }
    });
  }
}

function measureSelection(): string {
  const durations: number[] = [];
  for (const { id: difficulty } of difficultyLevels) {
    for (let index = 0; index < 2000; index += 1) {
      const startedAt = performance.now();
      selectNanpureProblemForDifficulty(difficulty, `measure-${index}`);
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

  const problems = new Set<string>();
  let duplicateCount = 0;
  let total = 0;
  const levels = {} as Record<NanpureDifficulty, NanpureProblemPoolEntry[]>;
  for (const { id: difficulty } of difficultyLevels) {
    levels[difficulty] = [...listNanpurePoolEntries(difficulty)];
    for (const entry of levels[difficulty]) {
      total += 1;
      if (problems.has(entry[2])) {
        duplicateCount += 1;
      }
      problems.add(entry[2]);
    }
  }

  console.log(
    `${total}問を検証 (${((performance.now() - startedAt) / 1000).toFixed(1)}s, jobs=${jobs}): 不合格 ${failures.length} / 重複 ${duplicateCount}`,
  );
  for (const failure of failures) {
    console.log(
      `  難易度 ${failure.difficulty} の ${failure.index}番: ${failure.reason}`,
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
