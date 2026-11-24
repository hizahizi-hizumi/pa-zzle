import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { gzipSync } from "node:zlib";
import { type DifficultyLevel, difficultyLevels } from "@/games/difficulty";
import {
  assessMagicSquareDifficulty,
  MAGIC_SQUARE_DIFFICULTY_MODEL_VERSION,
  type MagicSquareDifficulty,
} from "@/games/magic-square/difficulty";
import {
  analyzeMagicSquareDifficulty,
  MAGIC_SQUARE_SOLUTION_SEARCH_NODE_CAP,
  type MagicSquareReadingFeatures,
} from "@/games/magic-square/problem/difficulty-analysis";
import { listAllMagicSquares4 } from "@/games/magic-square/problem/generation/answers";
import {
  createMagicSquareCandidateRandom,
  formatMagicSquareCandidateConditions,
  formatMagicSquareCandidateId,
  generateMagicSquareCandidate,
  type MagicSquareCandidateConditions,
} from "@/games/magic-square/problem/generation/candidate";
import {
  createMagicSquarePoolCandidate,
  isMagicSquareExampleAnswer,
  judgeMagicSquarePoolCandidate,
  MAGIC_SQUARE_NEAR_DISTANCE_LIMIT,
  type MagicSquarePoolCandidate,
  type MagicSquarePoolDecision,
} from "@/games/magic-square/problem/generation/pool-rules";
import {
  countMagicSquareSolutions,
  type MagicSquareGrid,
} from "@/games/magic-square/problem/generation/solver";
import {
  isSameMagicSquareKey,
  measureMagicSquareNearDistance,
} from "@/games/magic-square/problem/generation/symmetry";
import {
  MAGIC_SQUARE_GENERATOR_VERSION,
  type MagicSquareBoardSize,
} from "@/games/magic-square/problem/problem";
import {
  listMagicSquarePoolEntries,
  type MagicSquareProblemPoolEntry,
  restoreMagicSquarePoolEntry,
  toMagicSquarePoolIdentity,
} from "@/games/magic-square/problem/problem-pool";
import {
  canSelectMagicSquareProblemById,
  selectMagicSquareProblemForDifficulty,
} from "@/games/magic-square/problem-selection";
import { createProblemId } from "@/games/problem-id";

const defaultPerLevel = 500;
const defaultJobCount = 1;
const defaultBatch = 32;

const usage = `Usage: bun run generate:magic-square-pool -- [options]

レベルごとに生成条件（盤面・読むモデルの段・仕上げ方）を巡回して、決定的な seed の候補を番号順に作り、問題集の規則
（例の魔方陣と同じ答え・同じ問題（列の構造の自己同型 × 補数）・4×4 の答えの向き違い・近い問題。レベルをまたぐ）に
当たらない候補だけを分類して、そのレベルに当たり、盤面の件数が埋まっていなければ採る。レベルの中は、盤面ごとに採った順を
保ち、盤面の件数の比で均等に混ぜる。

Options:
  --per-level <n>  レベルごとの問題数。盤面の件数は同じ比で決める (default: ${defaultPerLevel})
  --jobs <n>       候補を作る・分類する・問題を確かめる子プロセスの数。採る問題と確かめる結果は数に依らない
                   (default: ${defaultJobCount})
  --batch <n>      先読みして並べて調べる候補の数。採る問題は数に依らない (default: ${defaultBatch})
  --cache <file>   候補の記録（1候補1行の JSON）。あれば読み、無い候補だけを調べて書き足す
                   （途中で止まった生成を、同じ順で再開する）
  --out <file>     書き出す問題集 (default: 同梱の problem-pool.json)
  --levels <list>  組むレベル（例: 3,4,5）。ほかのレベルは空にする。候補の記録を先に埋めるためのもので、
                   同梱の問題集は全レベルを組んで作る (default: 1,2,3,4,5)
  --verify         生成せず、同梱の問題集の全問を identity から作り直し、答えを数え直し、分析・分類し直して、
                   レベルと作業の量の一致を確かめる。規則（例の魔方陣・同じ問題・4×4 の答えの向き違い・近い問題）と、
                   件数・盤面の内訳・並び・選び方・JSON の大きさは、問題集の全問の組から数え直す`;

const defaultOutputPath = new URL(
  "../src/games/magic-square/problem/problem-pool.json",
  import.meta.url,
);

/** 候補の記録の版。候補の作り方・分類・記録の形を変えたら、前の記録を使わない。 */
const candidateRecordVersion = `${MAGIC_SQUARE_GENERATOR_VERSION}/${MAGIC_SQUARE_DIFFICULTY_MODEL_VERSION}`;

type LevelPlan = {
  /** 盤面ごとの件数の比。 */
  shares: Partial<Record<MagicSquareBoardSize, number>>;
  /** 巡回する生成条件。 */
  conditions: readonly MagicSquareCandidateConditions[];
};

const addBack = (
  size: MagicSquareBoardSize,
  maxTier: number,
  count: number,
): MagicSquareCandidateConditions => ({
  size,
  maxTier,
  finish: { kind: "add-back", count },
});

const polish = (
  size: MagicSquareBoardSize,
  maxTier: number,
  target: "4" | "5",
): MagicSquareCandidateConditions => ({
  size,
  maxTier,
  finish: { kind: "polish", target },
});

/**
 * レベルごとの盤面の内訳と、巡回する生成条件。2つの盤面を許すレベルは半分ずつ。生成条件は、難易度の調査でそのレベルに
 * 当たる割合が高かったもの（L2 は 4×4 の T2 add0・T3 add1・T2 add1 と 5×5 の T2 add1・add2・add0、L3 は T2 の磨き、
 * L4 は T3 の L4 向けの磨き、L5 は T3 の L5 向けの磨き）。
 */
const levelPlans = {
  "1": { shares: { 4: 1 }, conditions: [addBack(4, 1, 0)] },
  "2": {
    shares: { 4: 1, 5: 1 },
    conditions: [
      addBack(5, 2, 1),
      addBack(4, 2, 0),
      addBack(5, 2, 2),
      addBack(4, 2, 1),
      addBack(5, 2, 0),
      addBack(4, 3, 1),
    ],
  },
  "3": {
    shares: { 5: 1, 6: 1 },
    conditions: [
      polish(5, 2, "5"),
      polish(6, 2, "5"),
      polish(5, 2, "4"),
      polish(6, 2, "4"),
    ],
  },
  "4": {
    shares: { 5: 1, 6: 1 },
    conditions: [polish(5, 3, "4"), polish(6, 3, "4")],
  },
  "5": {
    shares: { 5: 1, 6: 1 },
    conditions: [polish(5, 3, "5"), polish(6, 3, "5")],
  },
} as const satisfies Record<MagicSquareDifficulty, LevelPlan>;

/** 盤面ごとの件数。端数は大きい盤面へ。 */
function allocateQuota(
  plan: LevelPlan,
  perLevel: number,
): Map<MagicSquareBoardSize, number> {
  const shares = Object.entries(plan.shares).map(
    ([size, share]) => [Number(size) as MagicSquareBoardSize, share!] as const,
  );
  const total = shares.reduce((sum, [, share]) => sum + share, 0);
  const quota = new Map(
    shares.map(([size, share]) => [
      size,
      Math.floor((perLevel * share) / total),
    ]),
  );
  const largest = Math.max(...quota.keys()) as MagicSquareBoardSize;
  const assigned = [...quota.values()].reduce((sum, count) => sum + count, 0);
  quota.set(largest, quota.get(largest)! + perLevel - assigned);
  return quota;
}

/** 分類の記録。基準の読みの特徴は、問題集の作業の量と統計に使う。 */
type CandidateClassification = {
  outcome: string;
  difficulty: MagicSquareDifficulty | null;
  readingId: string | null;
  solutionSearchNodes: number | null;
  reading: MagicSquareReadingFeatures | null;
  assessMs: number;
};

type CandidateRecord = {
  version: string;
  id: string;
  conditions: MagicSquareCandidateConditions;
  index: number;
  givens: number[];
  solution: number[];
  generateMs: number;
  classification: CandidateClassification | null;
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

function generateRecord(
  conditions: MagicSquareCandidateConditions,
  index: number,
): CandidateRecord {
  if (conditions.size === 4) {
    // 4×4 の答えは全部の魔方陣から選ぶ。数え上げは1プロセスで1回なので、時間に入れない。
    listAllMagicSquares4();
  }
  const started = performance.now();
  const candidate = generateMagicSquareCandidate(
    conditions,
    createMagicSquareCandidateRandom(conditions, index),
  );
  return {
    version: candidateRecordVersion,
    id: formatMagicSquareCandidateId(conditions, index),
    conditions,
    index,
    givens: candidate.givens,
    solution: [...candidate.solution],
    generateMs: performance.now() - started,
    classification: null,
  };
}

function classifyGivens(
  size: number,
  givens: MagicSquareGrid,
): CandidateClassification {
  const started = performance.now();
  const analysis = analyzeMagicSquareDifficulty(size, givens);
  const assessment = assessMagicSquareDifficulty(analysis);
  return {
    outcome:
      assessment.status === "classified"
        ? `L${assessment.difficulty}`
        : assessment.status === "out-of-range"
          ? assessment.reason
          : assessment.status,
    difficulty:
      assessment.status === "classified" ? assessment.difficulty : null,
    readingId:
      assessment.status === "out-of-range" &&
      assessment.reason === "reading-dependent"
        ? assessment.readingId
        : null,
    solutionSearchNodes:
      analysis.status === "analyzed"
        ? analysis.features.solutionSearchNodeCount
        : null,
    reading: analysis.status === "analyzed" ? analysis.features.reading : null,
    assessMs: performance.now() - started,
  };
}

type WorkerTask =
  | {
      kind: "generate";
      jobs: { conditions: MagicSquareCandidateConditions; index: number }[];
    }
  | { kind: "classify"; jobs: { id: string; size: number; givens: number[] }[] }
  | {
      kind: "verify";
      jobs: {
        difficulty: MagicSquareDifficulty;
        entry: MagicSquareProblemPoolEntry;
      }[];
    };

/** `--worker` で起動された子プロセス: 渡された仕事を順に行い、1件1行の JSON で書き出す。 */
function runWorker(argument: string): void {
  const task = JSON.parse(argument) as WorkerTask;
  if (task.kind === "generate") {
    for (const { conditions, index } of task.jobs) {
      console.log(JSON.stringify(generateRecord(conditions, index)));
    }
  } else if (task.kind === "classify") {
    for (const { id, size, givens } of task.jobs) {
      console.log(
        JSON.stringify({ id, classification: classifyGivens(size, givens) }),
      );
    }
  } else {
    for (const { difficulty, entry } of task.jobs) {
      console.log(JSON.stringify(verifyEntry(difficulty, entry)));
    }
  }
}

/** 仕事を `jobCount` 個の子プロセスに分けて走らせ、出力の行を返す（並びは仕事の並びと違う）。 */
async function runInWorkers<Job, Output>(
  kind: WorkerTask["kind"],
  jobs: readonly Job[],
  jobCount: number,
): Promise<Output[]> {
  const shards = Array.from({ length: jobCount }, (_, shard) =>
    jobs.filter((_, index) => index % jobCount === shard),
  ).filter((shard) => shard.length > 0);
  const outputs = await Promise.all(
    shards.map(async (shard) => {
      const worker = Bun.spawn(
        [
          process.execPath,
          Bun.fileURLToPath(import.meta.url),
          "--worker",
          JSON.stringify({ kind, jobs: shard }),
        ],
        { stdout: "pipe", stderr: "inherit" },
      );
      const output = await new Response(worker.stdout).text();
      if ((await worker.exited) !== 0) {
        throw new Error(`A ${kind} worker failed`);
      }
      return output
        .trim()
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as Output);
    }),
  );
  return outputs.flat();
}

class CandidateCache {
  readonly records = new Map<string, CandidateRecord>();

  constructor(private readonly path: string | undefined) {
    if (path === undefined || !existsSync(path)) {
      return;
    }
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (line.length === 0) {
        continue;
      }
      const record = JSON.parse(line) as CandidateRecord;
      if (record.version === candidateRecordVersion) {
        this.records.set(record.id, record);
      }
    }
  }

  add(record: CandidateRecord): void {
    this.records.set(record.id, record);
    if (this.path !== undefined) {
      appendFileSync(this.path, `${JSON.stringify(record)}\n`);
    }
  }
}

type Job = { conditions: MagicSquareCandidateConditions; index: number };

const jobIdOf = ({ conditions, index }: Job) =>
  formatMagicSquareCandidateId(conditions, index);

/**
 * 磨く候補は1つ 0.2〜0.5 秒かかるので子プロセスで作る。戻す候補は数ミリ秒で、子プロセスを立ち上げる時間
 * （4×4 は全部の魔方陣を数える時間も）の方が長いので、このプロセスで作る。
 */
async function ensureGenerated(
  jobs: readonly Job[],
  cache: CandidateCache,
  jobCount: number,
): Promise<void> {
  const missing = jobs.filter((job) => !cache.records.has(jobIdOf(job)));
  const polished = missing.filter(
    ({ conditions }) => conditions.finish.kind === "polish",
  );
  const records = [
    ...missing
      .filter(({ conditions }) => conditions.finish.kind !== "polish")
      .map(({ conditions, index }) => generateRecord(conditions, index)),
    ...(jobCount === 1 || polished.length === 0
      ? polished.map(({ conditions, index }) =>
          generateRecord(conditions, index),
        )
      : await runInWorkers<Job, CandidateRecord>(
          "generate",
          polished,
          jobCount,
        )),
  ];
  for (const record of records) {
    cache.add(record);
  }
}

async function ensureClassified(
  records: readonly CandidateRecord[],
  cache: CandidateCache,
  jobCount: number,
): Promise<void> {
  const missing = records.filter(
    ({ classification }) => classification === null,
  );
  if (missing.length === 0) {
    return;
  }
  const results =
    jobCount === 1
      ? missing.map(({ id, conditions, givens }) => ({
          id,
          classification: classifyGivens(conditions.size, givens),
        }))
      : await runInWorkers<
          { id: string; size: number; givens: number[] },
          { id: string; classification: CandidateClassification }
        >(
          "classify",
          missing.map(({ id, conditions, givens }) => ({
            id,
            size: conditions.size,
            givens,
          })),
          jobCount,
        );
  for (const { id, classification } of results) {
    cache.add({ ...cache.records.get(id)!, classification });
  }
}

/**
 * 採否: `accept`、問題集の規則で除いた理由（`MagicSquarePoolDecision` の `example` など）、分類がそのレベルでない
 * （`other-level`、範囲外の理由か `invalid`）、その盤面の件数が埋まっている（`size-full`）。
 */
type Decision = MagicSquarePoolDecision["kind"] | string;

type DecisionLogEntry = {
  level: MagicSquareDifficulty;
  record: CandidateRecord;
  decision: Decision;
};

type AcceptedProblem = {
  record: CandidateRecord;
  reading: MagicSquareReadingFeatures;
};

/**
 * レベルごとに生成条件を巡回して候補を番号順に調べ、採る。採る条件はどれも「採る」の側で全部満たす必要があるので、
 * 採る問題は先読みの数・子プロセスの数に依らず、1つずつ調べたときと同じになる。
 */
async function assemblePool(
  perLevel: number,
  targetLevels: readonly MagicSquareDifficulty[],
  cache: CandidateCache,
  jobCount: number,
  batch: number,
): Promise<{
  levels: Record<MagicSquareDifficulty, AcceptedProblem[]>;
  log: DecisionLogEntry[];
}> {
  const accepted: MagicSquarePoolCandidate[] = [];
  const log: DecisionLogEntry[] = [];
  const levels = Object.fromEntries(
    difficultyLevels.map(({ id }) => [id, [] as AcceptedProblem[]]),
  ) as Record<MagicSquareDifficulty, AcceptedProblem[]>;
  const startedAt = performance.now();
  for (const level of targetLevels) {
    const plan: LevelPlan = levelPlans[level];
    const quota = allocateQuota(plan, perLevel);
    const conditionIds = plan.conditions.map(
      formatMagicSquareCandidateConditions,
    );
    const nextIndex = new Map(conditionIds.map((id) => [id, 0]));
    const counts = new Map<MagicSquareBoardSize, number>();
    let pointer = 0;
    const isActive = (conditions: MagicSquareCandidateConditions) =>
      (counts.get(conditions.size) ?? 0) < (quota.get(conditions.size) ?? 0);
    const activeIds = () =>
      plan.conditions
        .filter(isActive)
        .map(formatMagicSquareCandidateConditions)
        .join(",");
    while (plan.conditions.some(isActive)) {
      // 今の巡回で次に調べる候補を先読みする。
      const lookahead: Job[] = [];
      const plannedIndex = new Map(nextIndex);
      for (let step = pointer; lookahead.length < batch; step += 1) {
        const conditions = plan.conditions[step % plan.conditions.length]!;
        if (!isActive(conditions)) {
          continue;
        }
        const conditionId = formatMagicSquareCandidateConditions(conditions);
        const index = plannedIndex.get(conditionId)!;
        lookahead.push({ conditions, index });
        plannedIndex.set(conditionId, index + 1);
      }
      await ensureGenerated(lookahead, cache, jobCount);
      // 今の採った問題で規則に当たらない候補だけを分類する。採るにつれて規則は厳しくなるだけなので、ここで除いた候補は後でも除かれる。
      await ensureClassified(
        lookahead
          .map((job) => cache.records.get(jobIdOf(job))!)
          .filter(
            (record) =>
              judgeMagicSquarePoolCandidate(
                createMagicSquarePoolCandidate(record.givens, record.solution),
                accepted,
              ).kind === "accept",
          ),
        cache,
        jobCount,
      );
      const activeBefore = activeIds();
      for (const job of lookahead) {
        const conditionId = formatMagicSquareCandidateConditions(
          job.conditions,
        );
        while (
          formatMagicSquareCandidateConditions(
            plan.conditions[pointer % plan.conditions.length]!,
          ) !== conditionId ||
          !isActive(plan.conditions[pointer % plan.conditions.length]!)
        ) {
          pointer += 1;
        }
        pointer += 1;
        nextIndex.set(conditionId, job.index + 1);
        let record = cache.records.get(jobIdOf(job))!;
        const candidate = createMagicSquarePoolCandidate(
          record.givens,
          record.solution,
        );
        let decision: Decision = judgeMagicSquarePoolCandidate(
          candidate,
          accepted,
        ).kind;
        if (decision === "accept") {
          await ensureClassified([record], cache, 1);
          record = cache.records.get(record.id)!;
          const { classification } = record;
          const size = job.conditions.size;
          if (classification!.difficulty !== level) {
            decision =
              classification!.difficulty === null
                ? classification!.outcome
                : "other-level";
          } else if ((counts.get(size) ?? 0) >= (quota.get(size) ?? 0)) {
            decision = "size-full";
          } else {
            counts.set(size, (counts.get(size) ?? 0) + 1);
            accepted.push(candidate);
            levels[level].push({ record, reading: classification!.reading! });
          }
        }
        log.push({ level, record, decision });
        if (activeIds() !== activeBefore) {
          // 巡回する生成条件が変わったので、先読みをやり直す。
          break;
        }
      }
      console.error(
        `L${level} ${JSON.stringify(Object.fromEntries(counts))} cached ${cache.records.size} ${((performance.now() - startedAt) / 1000).toFixed(0)}s`,
      );
    }
  }
  return { levels, log };
}

/** レベルの並び: 盤面ごとに採った順を保ち、盤面ごとの j 番目に (j + 0.5) / その盤面の件数 を付けて小さい順に並べる（同じなら小さい盤面が先）。 */
function interleaveBySize<T>(
  items: readonly T[],
  sizeOf: (item: T) => number,
): T[] {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const group = groups.get(sizeOf(item)) ?? [];
    group.push(item);
    groups.set(sizeOf(item), group);
  }
  return [...groups]
    .flatMap(([size, group]) =>
      group.map((item, index) => ({
        item,
        size,
        index,
        position: (index + 0.5) / group.length,
      })),
    )
    .sort(
      (left, right) =>
        left.position - right.position ||
        left.size - right.size ||
        left.index - right.index,
    )
    .map(({ item }) => item);
}

function toPoolEntry(
  givens: readonly number[],
  reading: MagicSquareReadingFeatures,
): MagicSquareProblemPoolEntry {
  return [
    givens.join("."),
    reading.stuckPlaceCount,
    reading.tier3PlaceCount,
    reading.stuckSweepTotal,
  ];
}

function formatPool(
  levels: Record<MagicSquareDifficulty, readonly MagicSquareProblemPoolEntry[]>,
): string {
  const levelLines = difficultyLevels.map(({ id }, levelIndex) => {
    const entries = levels[id].map(
      (entry, index) =>
        `      ${JSON.stringify(entry)}${index + 1 < levels[id].length ? "," : ""}`,
    );
    return [
      `    "${id}": [`,
      ...entries,
      `    ]${levelIndex + 1 < difficultyLevels.length ? "," : ""}`,
    ].join("\n");
  });
  return [
    "{",
    `  "generatorVersion": ${JSON.stringify(MAGIC_SQUARE_GENERATOR_VERSION)},`,
    '  "levels": {',
    ...levelLines,
    "  }",
    "}",
    "",
  ].join("\n");
}

function quantiles(values: readonly number[]): string {
  if (values.length === 0) {
    return "-";
  }
  const sorted = [...values].sort((left, right) => left - right);
  const at = (ratio: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(ratio * sorted.length))]!;
  return `${at(0.1)} / ${at(0.5)} / ${at(0.9)}`;
}

function formatSeconds(milliseconds: readonly number[]): string {
  if (milliseconds.length === 0) {
    return "-";
  }
  const sorted = [...milliseconds].sort((left, right) => left - right);
  const at = (ratio: number) =>
    (
      sorted[Math.min(sorted.length - 1, Math.floor(ratio * sorted.length))]! /
      1000
    ).toFixed(2);
  return `${at(0.5)} / ${at(0.95)}`;
}

/** 収率と時間（生成条件ごと）、採らなかった理由、レベルごとの特徴の分布を出す。 */
function printStatistics(
  levels: Record<MagicSquareDifficulty, readonly AcceptedProblem[]>,
  log: readonly DecisionLogEntry[],
): void {
  console.log(
    "\n## 収率と時間（レベルの流れ × 生成条件。時間は1候補の p50 / p95 秒）",
  );
  console.log(
    "| レベル | 生成条件 | 調べた | 規則で除いた | 分類した | そのレベル | 採った | 当たる割合 | 作る | 分類 |",
  );
  console.log(
    "| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
  );
  for (const { id: level } of difficultyLevels) {
    const plan: LevelPlan = levelPlans[level];
    for (const conditions of plan.conditions) {
      const conditionId = formatMagicSquareCandidateConditions(conditions);
      const entries = log.filter(
        (entry) =>
          entry.level === level &&
          formatMagicSquareCandidateConditions(entry.record.conditions) ===
            conditionId,
      );
      const ruled = entries.filter(({ decision }) =>
        ["example", "duplicate", "same-answer-d4", "near"].includes(decision),
      );
      const classified = entries.filter(
        ({ record }) =>
          record.classification !== null &&
          !ruled.some((other) => other.record === record),
      );
      const hits = classified.filter(
        ({ record }) => record.classification!.difficulty === level,
      );
      const acceptedCount = entries.filter(
        ({ decision }) => decision === "accept",
      ).length;
      console.log(
        `| ${level} | ${conditionId} | ${entries.length} | ${ruled.length} | ${classified.length} | ${hits.length} | ${acceptedCount} | ${classified.length === 0 ? "-" : `${Math.round((hits.length / classified.length) * 100)}%`} | ${formatSeconds(entries.map(({ record }) => record.generateMs))} | ${formatSeconds(classified.map(({ record }) => record.classification!.assessMs))} |`,
      );
    }
  }
  console.log("\n## 採らなかった理由（レベルの流れごと）");
  for (const { id: level } of difficultyLevels) {
    const counts = new Map<string, number>();
    for (const { decision } of log.filter((entry) => entry.level === level)) {
      if (decision !== "accept") {
        counts.set(decision, (counts.get(decision) ?? 0) + 1);
      }
    }
    console.log(
      `- L${level}: ${
        [...counts]
          .sort(([, left], [, right]) => right - left)
          .map(([decision, count]) => `${decision} ${count}`)
          .join("・") || "なし"
      }`,
    );
  }
  const totalMs = [...new Set(log.map(({ record }) => record))].reduce(
    (sum, record) =>
      sum + record.generateMs + (record.classification?.assessMs ?? 0),
    0,
  );
  console.log(
    `\n調べた候補 ${new Set(log.map(({ record }) => record.id)).size}、作る・分類する時間の合計 ${(totalMs / 1000).toFixed(0)} 秒（1プロセスあたりに直した値）`,
  );
  console.log("\n## レベルごとの特徴（10 / 50 / 90 パーセンタイル）");
  console.log(
    "| レベル | 盤面 | 件数 | 空き | 与える数 | 最初の1マスの巡 | 段2の所の巡の最大 | 段3の所の数 | 組の突き合わせ | 絞り直し | 巡の合計 |",
  );
  console.log(
    "| ---: | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const { id: level } of difficultyLevels) {
    for (const size of [4, 5, 6]) {
      const problems = levels[level].filter(
        ({ record }) => record.conditions.size === size,
      );
      if (problems.length === 0) {
        continue;
      }
      const values = (read: (problem: AcceptedProblem) => number) =>
        quantiles(problems.map(read));
      console.log(
        `| ${level} | ${size} | ${problems.length} | ${values(({ record }) => record.givens.filter((value) => value === 0).length)} | ${values(({ record }) => record.givens.filter(Boolean).length)} | ${values(({ reading }) => reading.firstSweeps)} | ${values(({ reading }) => reading.tier2SweepsMax)} | ${values(({ reading }) => reading.tier3PlaceCount)} | ${values(({ reading }) => reading.stuckPlaceCount)} | ${values(({ reading }) => reading.reworkedPlaceCount)} | ${values(({ reading }) => reading.stuckSweepTotal)} |`,
      );
    }
  }
}

async function generatePool(): Promise<void> {
  const perLevel = readPositiveInteger("per-level", defaultPerLevel);
  const jobCount = readPositiveInteger("jobs", defaultJobCount);
  const batch = readPositiveInteger("batch", defaultBatch);
  const cache = new CandidateCache(readOption("cache"));
  const outputPath = readOption("out") ?? defaultOutputPath;
  const startedAt = performance.now();
  const targetLevels = (readOption("levels") ?? "1,2,3,4,5")
    .split(",")
    .map((level) => {
      const found = difficultyLevels.find(({ id }) => id === level);
      if (!found) {
        throw new RangeError(`Unknown level: ${level}`);
      }
      return found.id;
    });
  const { levels, log } = await assemblePool(
    perLevel,
    targetLevels,
    cache,
    jobCount,
    batch,
  );
  const ordered = Object.fromEntries(
    difficultyLevels.map(({ id }) => [
      id,
      interleaveBySize(levels[id], ({ record }) => record.conditions.size).map(
        ({ record, reading }) => toPoolEntry(record.givens, reading),
      ),
    ]),
  ) as Record<MagicSquareDifficulty, MagicSquareProblemPoolEntry[]>;
  writeFileSync(outputPath, formatPool(ordered));
  printStatistics(levels, log);
  console.log(
    `\n${outputPath} に書いた。壁時計 ${((performance.now() - startedAt) / 1000).toFixed(0)} 秒、子プロセス ${jobCount}`,
  );
}

type EntryVerification = {
  difficulty: MagicSquareDifficulty;
  seed: string;
  problems: string[];
  solution: number[];
  milliseconds: number;
};

/** 1問を identity から作り直し、答えを数え直し、分析・分類し直す。生成の途中結果と候補の記録は使わない。 */
function verifyEntry(
  difficulty: MagicSquareDifficulty,
  entry: MagicSquareProblemPoolEntry,
): EntryVerification {
  const started = performance.now();
  const problems: string[] = [];
  const restored = restoreMagicSquarePoolEntry(entry);
  const { size, cells } = restored.problem.givens;
  const givens = cells.map((cell) => cell ?? 0);
  const search = countMagicSquareSolutions(size, givens, {
    limit: 2,
    nodeCap: MAGIC_SQUARE_SOLUTION_SEARCH_NODE_CAP,
    collect: true,
  });
  if (search.count !== 1 || search.capped) {
    problems.push(`answers ${search.count}${search.capped ? " (capped)" : ""}`);
  }
  const analysis = analyzeMagicSquareDifficulty(size, givens);
  const assessment = assessMagicSquareDifficulty(analysis);
  if (
    assessment.status !== "classified" ||
    assessment.difficulty !== difficulty
  ) {
    problems.push(
      `assessment ${assessment.status === "classified" ? `L${assessment.difficulty}` : assessment.status === "out-of-range" ? assessment.reason : assessment.status}`,
    );
  }
  if (analysis.status === "analyzed") {
    const expected = toPoolEntry(givens, analysis.features.reading);
    if (JSON.stringify(expected) !== JSON.stringify(entry)) {
      problems.push(`workload ${JSON.stringify(expected)}`);
    }
  }
  return {
    difficulty,
    seed: entry[0],
    problems,
    solution: [...(search.solutions[0] ?? [])],
    milliseconds: performance.now() - started,
  };
}

/** 問題集の全問の組から、規則・件数・盤面の内訳・並び・選び方を数え直す。 */
function verifyPoolRules(
  verifications: readonly EntryVerification[],
): string[] {
  const problems: string[] = [];
  const perLevel = listMagicSquarePoolEntries("1").length;
  for (const { id: level } of difficultyLevels) {
    const entries = listMagicSquarePoolEntries(level);
    const quota = allocateQuota(levelPlans[level], perLevel);
    const sizes = entries.map(
      (entry) => toMagicSquarePoolIdentity(entry).conditions.size,
    );
    for (const [size, count] of quota) {
      const actual = sizes.filter((value) => value === size).length;
      if (actual !== count) {
        problems.push(
          `L${level} ${size}×${size}: ${actual} problems (expected ${count})`,
        );
      }
    }
    const reordered = interleaveBySize(
      entries.map((entry, index) => ({ entry, index })),
      ({ entry }) => toMagicSquarePoolIdentity(entry).conditions.size,
    );
    if (reordered.some(({ index }, position) => index !== position)) {
      problems.push(`L${level}: order is not interleaved by board size`);
    }
    for (let index = 0; index < 20; index += 1) {
      const selected = selectMagicSquareProblemForDifficulty(
        level,
        `verify-${index}`,
      );
      if (!entries.some((entry) => entry[0] === selected.identity.seed)) {
        problems.push(
          `L${level}: selection returned a problem outside the level`,
        );
      }
    }
    for (const entry of entries) {
      if (
        !canSelectMagicSquareProblemById(
          level,
          createProblemId(toMagicSquarePoolIdentity(entry)),
        )
      ) {
        problems.push(
          `L${level}: ${entry[0]} cannot be selected by problem ID`,
        );
      }
    }
  }
  const candidates = verifications.map((verification) => ({
    verification,
    candidate: createMagicSquarePoolCandidate(
      verification.seed.split(".").map(Number),
      verification.solution,
    ),
  }));
  const seeds = new Set<string>();
  for (const [index, { verification, candidate }] of candidates.entries()) {
    if (seeds.has(verification.seed)) {
      problems.push(`duplicate seed ${verification.seed}`);
    }
    seeds.add(verification.seed);
    if (isMagicSquareExampleAnswer(candidate.solution)) {
      problems.push(`${verification.seed}: answer is an example square`);
    }
    for (const {
      verification: other,
      candidate: otherCandidate,
    } of candidates.slice(index + 1)) {
      if (
        isSameMagicSquareKey(
          candidate.keys.problem,
          otherCandidate.keys.problem,
        )
      ) {
        problems.push(`same problem: ${verification.seed} / ${other.seed}`);
      }
      if (
        candidate.solution.length === 16 &&
        otherCandidate.solution.length === 16 &&
        isSameMagicSquareKey(
          candidate.keys.solutionD4,
          otherCandidate.keys.solutionD4,
        )
      ) {
        problems.push(
          `same 4×4 answer up to rotation: ${verification.seed} / ${other.seed}`,
        );
      }
      if (
        isSameMagicSquareKey(
          candidate.keys.solution,
          otherCandidate.keys.solution,
        )
      ) {
        const distance = measureMagicSquareNearDistance(
          otherCandidate,
          candidate,
        );
        if (distance !== null && distance <= MAGIC_SQUARE_NEAR_DISTANCE_LIMIT) {
          problems.push(
            `near problems (${distance}): ${verification.seed} / ${other.seed}`,
          );
        }
      }
    }
  }
  return problems;
}

async function verifyPool(): Promise<void> {
  const jobCount = readPositiveInteger("jobs", defaultJobCount);
  const startedAt = performance.now();
  const jobs = difficultyLevels.flatMap(({ id }) =>
    listMagicSquarePoolEntries(id).map((entry) => ({ difficulty: id, entry })),
  );
  const verifications =
    jobCount === 1
      ? jobs.map(({ difficulty, entry }) => verifyEntry(difficulty, entry))
      : await runInWorkers<
          { difficulty: DifficultyLevel; entry: MagicSquareProblemPoolEntry },
          EntryVerification
        >("verify", jobs, jobCount);
  const order = new Map(jobs.map(({ entry }, index) => [entry[0], index]));
  verifications.sort(
    (left, right) => order.get(left.seed)! - order.get(right.seed)!,
  );
  const entryProblems = verifications.flatMap(
    ({ difficulty, seed, problems }) =>
      problems.map((problem) => `L${difficulty} ${seed}: ${problem}`),
  );
  const poolProblems = verifyPoolRules(verifications);
  for (const problem of [...entryProblems, ...poolProblems]) {
    console.error(problem);
  }
  const json = readFileSync(defaultOutputPath);
  const selectionMs = (() => {
    const started = performance.now();
    for (let index = 0; index < 1000; index += 1) {
      selectMagicSquareProblemForDifficulty(
        difficultyLevels[index % 5]!.id,
        `timing-${index}`,
      );
    }
    return (performance.now() - started) / 1000;
  })();
  console.log(
    [
      `${verifications.length} 問を確かめた（子プロセス ${jobCount}、壁時計 ${((performance.now() - startedAt) / 1000).toFixed(0)} 秒、1問 p50 / p95 ${formatSeconds(verifications.map(({ milliseconds }) => milliseconds))} 秒）`,
      `JSON ${json.length} B（gzip -9 ${gzipSync(json, { level: 9 }).length} B）、選んで復元する時間 ${selectionMs.toFixed(3)} ms`,
      `不一致 ${entryProblems.length + poolProblems.length} 件`,
    ].join("\n"),
  );
  process.exitCode = entryProblems.length + poolProblems.length === 0 ? 0 : 1;
}

if (Bun.argv.includes("--worker")) {
  runWorker(Bun.argv[Bun.argv.indexOf("--worker") + 1]!);
} else if (Bun.argv.includes("--help")) {
  console.log(usage);
} else if (Bun.argv.includes("--verify")) {
  await verifyPool();
} else {
  await generatePool();
}
