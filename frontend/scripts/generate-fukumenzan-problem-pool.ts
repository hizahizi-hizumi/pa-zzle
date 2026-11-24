import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { gzipSync } from "node:zlib";
import { type DifficultyLevel, difficultyLevels } from "@/games/difficulty";
import {
  assessFukumenzanDifficulty,
  classifyFukumenzanProblem,
  type FukumenzanDifficulty,
  type FukumenzanDifficultyAssessment,
  fukumenzanAnalysisScope,
} from "@/games/fukumenzan/difficulty";
import {
  analyzeFukumenzanDifficulty,
  countFukumenzanOpeningLetters,
} from "@/games/fukumenzan/problem/difficulty-analysis";
import { countFukumenzanSolutions } from "@/games/fukumenzan/problem/generation/exact-solver";
import { tryFukumenzanNaively } from "@/games/fukumenzan/problem/generation/naive-trial";
import { listFukumenzanNearProblemKeys } from "@/games/fukumenzan/problem/generation/near-problem-keys";
import { generateFukumenzanProblem } from "@/games/fukumenzan/problem/generator";
import { fukumenzanGuideExampleProblems } from "@/games/fukumenzan/problem/guide-examples";
import {
  FUKUMENZAN_GENERATOR_VERSION,
  type FukumenzanProblem,
  formatFukumenzanEquation,
  getFukumenzanSameProblemKey,
} from "@/games/fukumenzan/problem/problem";
import {
  decodeFukumenzanPoolProblem,
  listFukumenzanPoolEntries,
  measureFukumenzanProblemFeatures,
} from "@/games/fukumenzan/problem/problem-pool";
import { measureFukumenzanWorkload } from "@/games/fukumenzan/problem/workload";
import { selectFukumenzanProblemForDifficulty } from "@/games/fukumenzan/problem-selection";
import { createProblemSeededRandom } from "@/games/problem-seed";

const defaultPerLevel = 500;

const defaultJobCount = 1;

/** 生成条件ごとの1巡を何巡まで回すか。 */
const defaultRoundBudget = 30_000;

/**
 * 1回にまとめて調べる巡の数。どの生成条件を回すかは、まとめの始めに決める。並列の数に依らないので、採る問題は
 * `--jobs` に依らない。
 */
const ROUNDS_PER_BATCH = 100;

/** 素朴な解き方を1問に当てる回数と、置く数の上限。 */
const NAIVE_TRIAL_COUNT = 3;
const NAIVE_PLACEMENT_LIMIT = 2000;

const usage = `Usage: bun run generate:fukumenzan-pool -- [options]

規模ごとに、生成条件（足す数の桁の並び × 文字の数）を巡回して、決定的な seed の候補を番号順に生成（一意解まで作り直す）・
分析・分類し、当たったレベルに採る。L1〜L3 は文字の数ごとに配分し（L1 は5・6・7文字を 40%・40%・20%、L2 は 50%・30%・20%、
L3 は 40%・40%・20%。3+3・3+3+3 は5文字だけ、L1 の 3+3 は 20% まで）、L4・L5 は 5+5+4 と 5+5+5 を 3:2 で、文字の数を
7・8・9 の順に回して作る。同じ問題（文字の付け替えと足す数の並べ替えで重なる問題）はレベルをまたいで、近い問題（1か所の
文字だけ違う問題）は同じレベルの中で、先に採った問題があれば飛ばす。遊び方の例の式と同じ問題は採らない。レベルの中は
生成条件×文字の数の組を交互に並べる。

Options:
  --per-level <n>  レベルごとの問題数 (default: ${defaultPerLevel})
  --budget <n>     規模ごとに回す巡の上限 (default: ${defaultRoundBudget})
  --jobs <n>       候補を調べる・問題を確かめる子プロセスの数。採る問題と確かめる結果は数に依らない (default: ${defaultJobCount})
  --cache-dir <d>  調べた候補の結果を <d> に書き足し、あれば読んで続きから作る（判定のコードを変えたら消す）
  --verify         生成せず、同梱の問題集の全問を式から解き直して一意解を確かめ、分析・分類し直してレベルの一致を確かめ、
                   同じ問題・近い問題・例の式との重なり・文字の数の配分・並び・JSON の大きさ・選択時間と、分布・素朴な
                   解き方の結果を出す`;

const outputPath = new URL(
  "../src/games/fukumenzan/problem/problem-pool.json",
  import.meta.url,
);

type CandidateGroup = {
  addendLengths: readonly number[];
  /** 候補の番号の順に回す文字の数。 */
  letterCounts: readonly number[];
  candidatesPerRound: number;
};

type Family = {
  id: string;
  levels: readonly FukumenzanDifficulty[];
  groups: readonly CandidateGroup[];
};

function singleLetterCountGroups(
  addendLengths: readonly number[],
  letterCounts: readonly number[],
): CandidateGroup[] {
  return letterCounts.map((letterCount) => ({
    addendLengths,
    letterCounts: [letterCount],
    candidatesPerRound: 1,
  }));
}

const families: readonly Family[] = [
  {
    id: "2s",
    levels: ["1"],
    groups: [
      ...singleLetterCountGroups([3, 3], [5]),
      ...singleLetterCountGroups([4, 3], [5, 6, 7]),
      ...singleLetterCountGroups([4, 4], [5, 6, 7]),
    ],
  },
  {
    id: "3s",
    levels: ["2", "3"],
    groups: [
      ...singleLetterCountGroups([3, 3, 3], [5]),
      ...singleLetterCountGroups([4, 4, 3], [5, 6, 7]),
      ...singleLetterCountGroups([4, 4, 4], [5, 6, 7]),
    ],
  },
  {
    id: "3l",
    levels: ["4", "5"],
    groups: [
      {
        addendLengths: [5, 5, 4],
        letterCounts: [7, 8, 9],
        candidatesPerRound: 3,
      },
      {
        addendLengths: [5, 5, 5],
        letterCounts: [7, 8, 9],
        candidatesPerRound: 2,
      },
    ],
  },
];

/** レベルの中の文字の数ごとの割合。持たないレベルは文字の数を配分しない。 */
const letterCountShares: Partial<
  Record<FukumenzanDifficulty, Readonly<Record<number, number>>>
> = {
  "1": { 5: 0.4, 6: 0.4, 7: 0.2 },
  "2": { 5: 0.5, 6: 0.3, 7: 0.2 },
  "3": { 5: 0.4, 6: 0.4, 7: 0.2 },
};

/** 3+3 の L1 は全部で 644 問、近い問題を飛ばすと 222 問しかないので、L1 の 20% までにする。 */
const groupShareLimits: readonly {
  level: FukumenzanDifficulty;
  addendLengths: readonly number[];
  share: number;
}[] = [{ level: "1", addendLengths: [3, 3], share: 0.2 }];

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

function lengthsKey(addendLengths: readonly number[]): string {
  return addendLengths.join("+");
}

/** レベルの中で交互に並べる組（生成条件×文字の数）。 */
function bucketKey(
  addendLengths: readonly number[],
  letterCount: number,
): string {
  return `${lengthsKey(addendLengths)}/${letterCount}`;
}

function listBucketKeys(family: Family): string[] {
  return family.groups.flatMap(({ addendLengths, letterCounts }) =>
    letterCounts.map((letterCount) => bucketKey(addendLengths, letterCount)),
  );
}

function getLetterCountQuotas(
  difficulty: FukumenzanDifficulty,
  perLevel: number,
): Map<number, number> | null {
  const shares = letterCountShares[difficulty];
  if (shares === undefined) {
    return null;
  }
  const entries = Object.entries(shares).map(
    ([letterCount, share]) => [Number(letterCount), share] as const,
  );
  const quotas = new Map(
    entries.map(([letterCount, share]) => [
      letterCount,
      Math.floor(perLevel * share),
    ]),
  );
  const assigned = [...quotas.values()].reduce((sum, value) => sum + value, 0);
  const [firstLetterCount] = entries[0]!;
  quotas.set(
    firstLetterCount,
    quotas.get(firstLetterCount)! + perLevel - assigned,
  );
  return quotas;
}

function getGroupLimit(
  difficulty: FukumenzanDifficulty,
  addendLengths: readonly number[],
  perLevel: number,
): number {
  const limit = groupShareLimits.find(
    (rule) =>
      rule.level === difficulty &&
      lengthsKey(rule.addendLengths) === lengthsKey(addendLengths),
  );
  return limit === undefined
    ? Number.POSITIVE_INFINITY
    : Math.floor(perLevel * limit.share);
}

type CandidateSpec = {
  seed: string;
  addendLengths: readonly number[];
  letterCount: number;
};

type CandidateRecord = {
  seed: string;
  equation: string | null;
  /**
   * レベル（`1`〜`5`）、提供範囲外の理由、`unsupported:stalled`・`unsupported:frontier-cap`・`invalid`、作れなければ
   * `no-problem`。
   */
  outcome: string;
  milliseconds: number;
};

function describeOutcome(assessment: FukumenzanDifficultyAssessment): string {
  switch (assessment.status) {
    case "classified":
      return assessment.difficulty;
    case "out-of-range":
      return assessment.reason;
    default:
      return assessment.status;
  }
}

function evaluateCandidate({
  seed,
  addendLengths,
  letterCount,
}: CandidateSpec): CandidateRecord {
  const started = performance.now();
  const generated = generateFukumenzanProblem(
    { addendLengths, letterCount },
    createProblemSeededRandom(seed),
  );
  if (generated === null) {
    return {
      seed,
      equation: null,
      outcome: "no-problem",
      milliseconds: performance.now() - started,
    };
  }
  const analysis = analyzeFukumenzanDifficulty(
    generated.problem,
    fukumenzanAnalysisScope,
  );
  const outcome =
    analysis.status === "unsupported"
      ? `unsupported:${analysis.cause}`
      : describeOutcome(assessFukumenzanDifficulty(analysis));
  return {
    seed,
    equation: formatFukumenzanEquation(generated.problem),
    outcome,
    milliseconds: performance.now() - started,
  };
}

/** `--worker` で起動された子プロセス: 渡された候補を順に調べ、1候補1行の JSON で書き出す。 */
function runWorker(argument: string): void {
  for (const spec of JSON.parse(argument) as CandidateSpec[]) {
    console.log(JSON.stringify(evaluateCandidate(spec)));
  }
}

async function runInParallel<T>(
  flag: string,
  items: readonly unknown[],
  jobCount: number,
): Promise<T[]> {
  const shards = Array.from({ length: jobCount }, (_, shard) =>
    items.filter((_, index) => index % jobCount === shard),
  ).filter((shard) => shard.length > 0);
  const outputs = await Promise.all(
    shards.map(async (shard) => {
      const worker = Bun.spawn(
        [
          process.execPath,
          Bun.fileURLToPath(import.meta.url),
          flag,
          JSON.stringify(shard),
        ],
        { stdout: "pipe", stderr: "inherit" },
      );
      const output = await new Response(worker.stdout).text();
      if ((await worker.exited) !== 0) {
        throw new Error(`A ${flag} process failed`);
      }
      return output
        .trim()
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as T);
    }),
  );
  return outputs.flat();
}

type LevelSelection = {
  buckets: Map<string, string[]>;
  letterCounts: Map<number, number>;
  groupCounts: Map<string, number>;
  nearKeys: Set<string>;
  total: number;
  filledAt: { candidates: number; seconds: number } | null;
};

type FamilyStatistics = {
  candidates: number;
  outcomes: Map<string, number>;
  hitsByBucket: Map<string, Map<string, number>>;
  candidatesByBucket: Map<string, number>;
  milliseconds: number[];
  duplicateCount: number;
  nearSkipCount: number;
  seconds: number;
};

function increment<K>(map: Map<K, number>, key: K, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

function needsLetterCount(
  difficulty: FukumenzanDifficulty,
  selection: LevelSelection,
  addendLengths: readonly number[],
  letterCount: number,
  perLevel: number,
): boolean {
  if (selection.total >= perLevel) {
    return false;
  }
  const quotas = getLetterCountQuotas(difficulty, perLevel);
  if (
    quotas !== null &&
    (selection.letterCounts.get(letterCount) ?? 0) >=
      (quotas.get(letterCount) ?? 0)
  ) {
    return false;
  }
  return (
    (selection.groupCounts.get(lengthsKey(addendLengths)) ?? 0) <
    getGroupLimit(difficulty, addendLengths, perLevel)
  );
}

function readCache(path: string | undefined): Map<string, CandidateRecord> {
  const records = new Map<string, CandidateRecord>();
  if (path === undefined || !existsSync(path)) {
    return records;
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line.length > 0) {
      const record = JSON.parse(line) as CandidateRecord;
      records.set(record.seed, record);
    }
  }
  return records;
}

async function selectFamily(
  family: Family,
  perLevel: number,
  roundBudget: number,
  jobCount: number,
  takenKeys: Set<string>,
  cachePath: string | undefined,
): Promise<{
  selections: Map<FukumenzanDifficulty, LevelSelection>;
  statistics: FamilyStatistics;
}> {
  const started = performance.now();
  const cache = readCache(cachePath);
  const selections = new Map<FukumenzanDifficulty, LevelSelection>(
    family.levels.map((level) => [
      level,
      {
        buckets: new Map(listBucketKeys(family).map((key) => [key, []])),
        letterCounts: new Map(),
        groupCounts: new Map(),
        nearKeys: new Set(),
        total: 0,
        filledAt: null,
      },
    ]),
  );
  const statistics: FamilyStatistics = {
    candidates: 0,
    outcomes: new Map(),
    hitsByBucket: new Map(),
    candidatesByBucket: new Map(),
    milliseconds: [],
    duplicateCount: 0,
    nearSkipCount: 0,
    seconds: 0,
  };
  const candidateIndices = family.groups.map(() => 0);
  function isFull(): boolean {
    return [...selections.values()].every(({ total }) => total >= perLevel);
  }
  for (
    let round = 0;
    round < roundBudget && !isFull();
    round += ROUNDS_PER_BATCH
  ) {
    const activeGroups = family.groups.map((group) =>
      family.levels.some((level) =>
        group.letterCounts.some((letterCount) =>
          needsLetterCount(
            level,
            selections.get(level)!,
            group.addendLengths,
            letterCount,
            perLevel,
          ),
        ),
      ),
    );
    const specs: (CandidateSpec & { group: number })[] = [];
    for (let offset = 0; offset < ROUNDS_PER_BATCH; offset += 1) {
      for (const [groupIndex, group] of family.groups.entries()) {
        if (!activeGroups[groupIndex]) {
          continue;
        }
        for (let slot = 0; slot < group.candidatesPerRound; slot += 1) {
          const index = candidateIndices[groupIndex]!;
          candidateIndices[groupIndex] = index + 1;
          const letterCount =
            group.letterCounts[index % group.letterCounts.length]!;
          specs.push({
            seed: `fukumenzan:${lengthsKey(group.addendLengths)}/${letterCount}/${index}`,
            addendLengths: group.addendLengths,
            letterCount,
            group: groupIndex,
          });
        }
      }
    }
    const missing = specs.filter(({ seed }) => !cache.has(seed));
    const evaluated = await runInParallel<CandidateRecord>(
      "--worker",
      missing.map(({ seed, addendLengths, letterCount }) => ({
        seed,
        addendLengths,
        letterCount,
      })),
      jobCount,
    );
    for (const record of evaluated) {
      cache.set(record.seed, record);
    }
    if (cachePath !== undefined && evaluated.length > 0) {
      appendFileSync(
        cachePath,
        evaluated.map((record) => `${JSON.stringify(record)}\n`).join(""),
      );
    }
    for (const spec of specs) {
      const record = cache.get(spec.seed)!;
      const bucket = bucketKey(spec.addendLengths, spec.letterCount);
      statistics.candidates += 1;
      statistics.milliseconds.push(record.milliseconds);
      increment(statistics.outcomes, record.outcome);
      increment(statistics.candidatesByBucket, bucket);
      const level = family.levels.find((id) => id === record.outcome);
      if (level === undefined || record.equation === null) {
        continue;
      }
      const hits = statistics.hitsByBucket.get(bucket) ?? new Map();
      increment(hits, level);
      statistics.hitsByBucket.set(bucket, hits);
      const selection = selections.get(level)!;
      if (
        !needsLetterCount(
          level,
          selection,
          spec.addendLengths,
          spec.letterCount,
          perLevel,
        )
      ) {
        continue;
      }
      const problem = decodeFukumenzanPoolProblem(record.equation);
      const sameKey = getFukumenzanSameProblemKey(problem);
      if (takenKeys.has(sameKey)) {
        statistics.duplicateCount += 1;
        continue;
      }
      const nearKeys = listFukumenzanNearProblemKeys(problem);
      if ([...nearKeys].some((key) => selection.nearKeys.has(key))) {
        statistics.nearSkipCount += 1;
        continue;
      }
      takenKeys.add(sameKey);
      for (const key of nearKeys) {
        selection.nearKeys.add(key);
      }
      selection.buckets.get(bucket)!.push(record.equation);
      increment(selection.letterCounts, spec.letterCount);
      increment(selection.groupCounts, lengthsKey(spec.addendLengths));
      selection.total += 1;
      if (selection.total === perLevel) {
        selection.filledAt = {
          candidates: statistics.candidates,
          seconds: (performance.now() - started) / 1000,
        };
      }
    }
    console.error(
      `${family.id}: ${statistics.candidates} 候補（${((performance.now() - started) / 1000).toFixed(0)} 秒）` +
        [...selections]
          .map(([level, { total }]) => ` L${level} ${total}`)
          .join(""),
    );
  }
  statistics.seconds = (performance.now() - started) / 1000;
  return { selections, statistics };
}

function interleave(groups: readonly (readonly string[])[]): string[] {
  const longest = Math.max(0, ...groups.map((group) => group.length));
  return Array.from({ length: longest }, (_, index) =>
    groups.flatMap((group) => (index < group.length ? [group[index]!] : [])),
  ).flat();
}

function quantile(sorted: readonly number[], ratio: number): number {
  return sorted[
    Math.min(sorted.length - 1, Math.floor(ratio * sorted.length))
  ]!;
}

function describeDistribution(values: readonly number[], digits = 0): string {
  if (values.length === 0) {
    return "-";
  }
  const sorted = [...values].sort((left, right) => left - right);
  return [0, 0.1, 0.5, 0.9, 1]
    .map((ratio) => quantile(sorted, ratio).toFixed(digits))
    .join(" / ");
}

function formatCounts(counts: ReadonlyMap<string | number, number>): string {
  return [...counts]
    .sort(([left], [right]) => String(left).localeCompare(String(right)))
    .map(([value, count]) => `${value}:${count}`)
    .join(" ");
}

function countValues(
  values: readonly (string | number)[],
): Map<string | number, number> {
  const counts = new Map<string | number, number>();
  for (const value of values) {
    increment(counts, value);
  }
  return counts;
}

function formatPoolJson(
  levels: Record<FukumenzanDifficulty, readonly string[]>,
): string {
  const body = difficultyLevels
    .map(
      ({ id }) =>
        `    "${id}": [\n${levels[id].map((entry) => `      ${JSON.stringify(entry)}`).join(",\n")}\n    ]`,
    )
    .join(",\n");
  return `{\n  "generatorVersion": ${JSON.stringify(FUKUMENZAN_GENERATOR_VERSION)},\n  "levels": {\n${body}\n  }\n}\n`;
}

function listGuideExampleKeys(): Set<string> {
  return new Set(
    Object.values(fukumenzanGuideExampleProblems).map(
      getFukumenzanSameProblemKey,
    ),
  );
}

function printFamilyStatistics(
  family: Family,
  selections: Map<FukumenzanDifficulty, LevelSelection>,
  statistics: FamilyStatistics,
  jobCount: number,
): void {
  const sorted = [...statistics.milliseconds].sort(
    (left, right) => left - right,
  );
  console.log(
    `\n## ${family.id}: ${statistics.candidates} 候補・${statistics.seconds.toFixed(0)} 秒（${jobCount} 並列）・1候補 p50 ${quantile(sorted, 0.5).toFixed(1)}ms・p95 ${quantile(sorted, 0.95).toFixed(1)}ms（生成＋分析＋分類。1コア）`,
  );
  console.log(`- 結果: ${formatCounts(statistics.outcomes)}`);
  console.log(
    `- 同じ問題で飛ばした ${statistics.duplicateCount}・近い問題で飛ばした ${statistics.nearSkipCount}`,
  );
  console.log(
    "| 組 | 候補 | " +
      family.levels.map((level) => `L${level}`).join(" | ") +
      " |",
  );
  console.log(`|---|---|${family.levels.map(() => "---|").join("")}`);
  for (const key of listBucketKeys(family)) {
    const candidates = statistics.candidatesByBucket.get(key) ?? 0;
    const hits = statistics.hitsByBucket.get(key) ?? new Map();
    console.log(
      `| ${key} | ${candidates} | ` +
        family.levels
          .map((level) => {
            const count = hits.get(level) ?? 0;
            return `${count}（${candidates === 0 ? 0 : ((count / candidates) * 100).toFixed(1)}%）`;
          })
          .join(" | ") +
        " |",
    );
  }
  for (const [level, selection] of selections) {
    console.log(
      `- L${level}: 採った ${selection.total} 問（文字 ${formatCounts(selection.letterCounts)}・生成条件 ${formatCounts(selection.groupCounts)}）` +
        (selection.filledAt === null
          ? "・足りない"
          : `・${selection.filledAt.candidates} 候補目・${selection.filledAt.seconds.toFixed(0)} 秒でそろった`),
    );
  }
}

async function runMain(): Promise<void> {
  const perLevel = readPositiveInteger("per-level", defaultPerLevel);
  const roundBudget = readPositiveInteger("budget", defaultRoundBudget);
  const jobCount = readPositiveInteger("jobs", defaultJobCount);
  const cacheDirectory = readOption("cache-dir");
  if (cacheDirectory !== undefined) {
    mkdirSync(cacheDirectory, { recursive: true });
  }
  const takenKeys = listGuideExampleKeys();
  const levels = {} as Record<FukumenzanDifficulty, string[]>;
  for (const family of families) {
    const { selections, statistics } = await selectFamily(
      family,
      perLevel,
      roundBudget,
      jobCount,
      takenKeys,
      cacheDirectory === undefined
        ? undefined
        : `${cacheDirectory}/${family.id}.jsonl`,
    );
    printFamilyStatistics(family, selections, statistics, jobCount);
    for (const [level, { buckets }] of selections) {
      levels[level] = interleave(
        listBucketKeys(family).map((key) => buckets.get(key)!),
      );
    }
  }
  const shortages = difficultyLevels.filter(
    ({ id }) => levels[id].length < perLevel,
  );
  if (shortages.length > 0) {
    throw new Error(
      `Fukumenzan problem pool is short at ${shortages.map(({ id }) => `L${id} (${levels[id].length})`).join(", ")}`,
    );
  }
  writeFileSync(outputPath, formatPoolJson(levels));
  console.log(`\n${Bun.fileURLToPath(outputPath)} に書いた`);
}

type VerifiedEntry = {
  difficulty: FukumenzanDifficulty;
  index: number;
  reason: string | null;
  readingClass: string | null;
  openingLetterCount: number;
  naive: { solved: boolean; placementCount: number; backtrackCount: number }[];
};

function verifyEntry(
  difficulty: FukumenzanDifficulty,
  index: number,
): VerifiedEntry {
  const entry = listFukumenzanPoolEntries(difficulty)[index]!;
  let problem: FukumenzanProblem;
  try {
    problem = decodeFukumenzanPoolProblem(entry);
  } catch (error) {
    return {
      difficulty,
      index,
      reason: `読めない式: ${String(error)}`,
      readingClass: null,
      openingLetterCount: 0,
      naive: [],
    };
  }
  const solutionCount = countFukumenzanSolutions(problem, 3).count;
  const assessment = classifyFukumenzanProblem(problem);
  const outcome = describeOutcome(assessment);
  const reason =
    solutionCount !== 1
      ? `解の数 ${solutionCount}`
      : outcome !== difficulty
        ? `分類 ${outcome}`
        : null;
  return {
    difficulty,
    index,
    reason,
    readingClass:
      assessment.status === "classified"
        ? assessment.features.readingClass
        : null,
    openingLetterCount: countFukumenzanOpeningLetters(problem),
    naive: Array.from({ length: NAIVE_TRIAL_COUNT }, (_, trial) =>
      tryFukumenzanNaively(
        problem,
        createProblemSeededRandom(`fukumenzan-naive:${entry}#${trial}`),
        NAIVE_PLACEMENT_LIMIT,
      ),
    ),
  };
}

/** `--verify-worker` で起動された子プロセス: 渡された難易度と番号の問題を確かめ、1問1行の JSON で書き出す。 */
function runVerifyWorker(argument: string): void {
  for (const [difficulty, index] of JSON.parse(argument) as [
    FukumenzanDifficulty,
    number,
  ][]) {
    console.log(JSON.stringify(verifyEntry(difficulty, index)));
  }
}

function measureSelection(): string {
  const started = performance.now();
  const count = 2_000;
  for (let index = 0; index < count; index += 1) {
    const { id } = difficultyLevels[index % difficultyLevels.length]!;
    selectFukumenzanProblemForDifficulty(id, `verify-${index}`);
  }
  return `${((performance.now() - started) / count).toFixed(3)}ms/問`;
}

function findFamily(difficulty: DifficultyLevel): Family {
  return families.find(({ levels }) => levels.includes(difficulty))!;
}

/** 採った問題の組（生成条件×文字の数）から、交互に並べた並びを作り直す。 */
function reorderLikeGeneration(
  difficulty: FukumenzanDifficulty,
  entries: readonly string[],
): string[] | null {
  const family = findFamily(difficulty);
  const buckets = new Map(
    listBucketKeys(family).map((key) => [key, [] as string[]]),
  );
  for (const entry of entries) {
    const problem = decodeFukumenzanPoolProblem(entry);
    const bucket = buckets.get(
      bucketKey(
        problem.addends.map((addend) => addend.length),
        measureFukumenzanProblemFeatures(problem).letterCount,
      ),
    );
    if (bucket === undefined) {
      return null;
    }
    bucket.push(entry);
  }
  return interleave([...buckets.values()]);
}

async function runVerify(): Promise<void> {
  const started = performance.now();
  const jobCount = readPositiveInteger("jobs", defaultJobCount);
  const targets = difficultyLevels.flatMap(({ id }) =>
    listFukumenzanPoolEntries(id).map((_, index) => [id, index] as const),
  );
  const verified = await runInParallel<VerifiedEntry>(
    "--verify-worker",
    targets,
    jobCount,
  );
  const byEntry = new Map(
    verified.map((result) => [`${result.difficulty}:${result.index}`, result]),
  );
  const failures = verified.filter(({ reason }) => reason !== null);
  const guideKeys = listGuideExampleKeys();
  const sameKeys = new Set<string>();
  let duplicateCount = 0;
  let nearCount = 0;
  let guideOverlapCount = 0;
  let allocationViolationCount = 0;
  let orderViolationCount = 0;
  const perLevel = listFukumenzanPoolEntries("1").length;
  console.log("\n## 分布（最小 / 10 / 50 / 90 / 最大）");
  for (const { id } of difficultyLevels) {
    const entries = listFukumenzanPoolEntries(id);
    const problems = entries.map(decodeFukumenzanPoolProblem);
    const nearOwners = new Map<string, number>();
    for (const [index, problem] of problems.entries()) {
      const sameKey = getFukumenzanSameProblemKey(problem);
      if (sameKeys.has(sameKey)) {
        duplicateCount += 1;
      }
      sameKeys.add(sameKey);
      if (guideKeys.has(sameKey)) {
        guideOverlapCount += 1;
      }
      const nearKeys = listFukumenzanNearProblemKeys(problem);
      if ([...nearKeys].some((key) => nearOwners.has(key))) {
        nearCount += 1;
      }
      for (const key of nearKeys) {
        nearOwners.set(key, index);
      }
    }
    const features = problems.map(measureFukumenzanProblemFeatures);
    const workloads = problems.map(measureFukumenzanWorkload);
    const letterCounts = countValues(
      features.map(({ letterCount }) => letterCount),
    );
    const conditions = countValues(
      problems.map(({ addends }) =>
        addends.map((addend) => addend.length).join("+"),
      ),
    );
    const quotas = getLetterCountQuotas(id, perLevel);
    const family = findFamily(id);
    const allowedBuckets = new Set(listBucketKeys(family));
    const outsideBuckets = problems.filter(
      (problem) =>
        !allowedBuckets.has(
          bucketKey(
            problem.addends.map((addend) => addend.length),
            measureFukumenzanProblemFeatures(problem).letterCount,
          ),
        ),
    ).length;
    const quotaMisses =
      quotas === null
        ? 0
        : [...quotas].filter(
            ([letterCount, quota]) =>
              (letterCounts.get(letterCount) ?? 0) !== quota,
          ).length;
    const groupMisses = groupShareLimits.filter(
      (rule) =>
        rule.level === id &&
        (conditions.get(lengthsKey(rule.addendLengths)) ?? 0) >
          getGroupLimit(id, rule.addendLengths, perLevel),
    ).length;
    allocationViolationCount += outsideBuckets + quotaMisses + groupMisses;
    const reordered = reorderLikeGeneration(id, entries);
    if (
      reordered === null ||
      reordered.some((entry, index) => entry !== entries[index])
    ) {
      orderViolationCount += 1;
    }
    const results = entries.map((_, index) => byEntry.get(`${id}:${index}`)!);
    const trials = results.flatMap(({ naive }, index) =>
      naive.map((trial) => ({
        ...trial,
        letterCount: features[index]!.letterCount,
      })),
    );
    const placementsPerLetter = trials.map(
      ({ solved, placementCount, letterCount }) =>
        solved ? placementCount / letterCount : Number.POSITIVE_INFINITY,
    );
    function shareWithin(multiple: number): string {
      return `${((placementsPerLetter.filter((value) => value <= multiple).length / Math.max(1, trials.length)) * 100).toFixed(0)}%`;
    }
    const alwaysWithin20 = results.filter(({ naive }, index) =>
      naive.every(
        ({ solved, placementCount }) =>
          solved && placementCount <= 20 * features[index]!.letterCount,
      ),
    ).length;
    console.log(
      [
        `L${id}: ${entries.length}問`,
        `  文字の数 ${formatCounts(letterCounts)} / 生成条件 ${formatCounts(conditions)}`,
        `  文字 ${describeDistribution(features.map(({ letterCount }) => letterCount))}`,
        `  同じ文字の桁 ${describeDistribution(features.map(({ sameLetterColumnCount }) => sameLetterColumnCount))}`,
        `  式の文字のマス ${describeDistribution(workloads.map(({ letterCellCount }) => letterCellCount))}`,
        `  入口（1桁ずつ1回読んで決まる文字） ${describeDistribution(results.map(({ openingLetterCount }) => openingLetterCount))}`,
        `  読みの組 ${formatCounts(countValues(results.map(({ readingClass }) => readingClass ?? "-")))}`,
        `  素朴な解き方（${NAIVE_TRIAL_COUNT}回・上限${NAIVE_PLACEMENT_LIMIT}）: 置いた数 ${describeDistribution(trials.map(({ solved, placementCount }) => (solved ? placementCount : NAIVE_PLACEMENT_LIMIT + 1)))}・戻した数 ${describeDistribution(trials.map(({ backtrackCount }) => backtrackCount))}・10×文字以内 ${shareWithin(10)}・20×文字以内 ${shareWithin(20)}・上限以内 ${((trials.filter(({ solved }) => solved).length / Math.max(1, trials.length)) * 100).toFixed(0)}%・3回とも20×文字以内の問題 ${alwaysWithin20}`,
      ].join("\n"),
    );
  }
  const levels = Object.fromEntries(
    difficultyLevels.map(({ id }) => [id, listFukumenzanPoolEntries(id)]),
  ) as Record<FukumenzanDifficulty, readonly string[]>;
  const json = formatPoolJson(levels);
  console.log(
    `\n全 ${targets.length} 問を ${((performance.now() - started) / 1000).toFixed(1)} 秒で確かめた（${jobCount} 並列）`,
  );
  console.log(
    `解き直し・分類の不一致 ${failures.length}・同じ問題 ${duplicateCount}・近い問題 ${nearCount}・例の式と同じ問題 ${guideOverlapCount}・配分の外れ ${allocationViolationCount}・並びの外れ ${orderViolationCount}`,
  );
  console.log(
    `問題集の大きさ ${(Buffer.byteLength(json) / 1024).toFixed(1)} KiB（gzip ${(gzipSync(json).length / 1024).toFixed(1)} KiB）・選択 ${measureSelection()}`,
  );
  if (
    failures.length > 0 ||
    duplicateCount > 0 ||
    nearCount > 0 ||
    guideOverlapCount > 0 ||
    allocationViolationCount > 0 ||
    orderViolationCount > 0
  ) {
    for (const failure of failures.slice(0, 20)) {
      console.error(
        `L${failure.difficulty}#${failure.index}: ${failure.reason}`,
      );
    }
    throw new Error("Fukumenzan problem pool verification failed");
  }
  console.log("\n不一致 0");
}

if (Bun.argv.includes("--help")) {
  console.log(usage);
} else if (Bun.argv.includes("--verify-worker")) {
  runVerifyWorker(Bun.argv[Bun.argv.indexOf("--verify-worker") + 1]!);
} else if (Bun.argv.includes("--worker")) {
  runWorker(Bun.argv[Bun.argv.indexOf("--worker") + 1]!);
} else if (Bun.argv.includes("--verify")) {
  await runVerify();
} else {
  await runMain();
}
