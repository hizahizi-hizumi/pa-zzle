import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import {
  assessBridgesDifficulty,
  type BridgesDifficulty,
  listBridgesGenerationConditions,
} from "@/games/bridges/difficulty";
import {
  analyzeBridgesDifficulty,
  type BridgesDifficultyAnalysis,
} from "@/games/bridges/problem/difficulty-analysis";
import {
  describeBridgesSolveFingerprint,
  describeBridgesSolveFlow,
} from "@/games/bridges/problem/generation/human-solver";
import {
  getBridgesLayoutKey,
  getBridgesSymmetryKey,
} from "@/games/bridges/problem/generation/symmetry";
import { generateBridgesProblem } from "@/games/bridges/problem/generator";
import {
  BRIDGES_GENERATOR_VERSION,
  type BridgesGenerationConditions,
  createBridgesProblemIdentity,
} from "@/games/bridges/problem/problem";
import {
  type BridgesProblemPoolEntry,
  encodeBridgesPoolClues,
  encodeBridgesPoolIslands,
  listBridgesPoolEntries,
  toBridgesPoolAnalysis,
  toBridgesPooledProblem,
} from "@/games/bridges/problem/problem-pool";
import { selectBridgesProblemForDifficulty } from "@/games/bridges/problem-selection";
import {
  formatBridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import { difficultyLevels } from "@/games/difficulty";

const defaultPerLevel = 500;

/**
 * 1つのレベルで、同じ解く手順の流れ（手詰まりごとの段と狭めた組の数）を持つ問題の数の上限（問題数に対する割合）。
 * どこで止まりどう抜けるかの流れが同じ問題が並ぶと、同じ手順の繰り返しになる。
 */
const MAXIMUM_FLOW_SHARE = 0.02;

function getFlowLimit(perLevel: number): number {
  return Math.max(1, Math.ceil(perLevel * MAXIMUM_FLOW_SHARE));
}

/** 1つのレベルで、同じ解く手順の指紋（流れに、読む数字の組と外周に沿うかを足したもの）を持つ問題の数の上限。 */
const FINGERPRINT_LIMIT = 3;

/**
 * 問題の手筋と見せ場の札。レベルの中で、札のある問題の割合に下限・上限を置き、どのレベルにも同じ形の問題が並ばないようにする。
 * - `corner-opening`: 盤面の四隅の島の決め打ちがある（どの盤面でも同じ始まりになりやすい）。レベル1 の 6×6 は、決め打ちの島の
 *   多くが四隅になるので、上限を半分にする。
 * - `passage`: 唯一の通り道の読みが要る。
 * - `seven-plus`: 7 か 8 の島がある。
 * - `loop`: 解に輪がある。
 * - `chained-lookahead`: 1手の先読みの結果から、すぐ次の1手の先読みが要る。
 * - `deep-lookahead`: 1手の先読みが3回以上要る。
 */
type BridgesProblemTag =
  | "corner-opening"
  | "passage"
  | "seven-plus"
  | "loop"
  | "chained-lookahead"
  | "deep-lookahead";

type TagShareRule = {
  tag: BridgesProblemTag;
  minimum?: number;
  maximum?: number;
};

/**
 * レベル3 で、唯一の通り道の読みが要る問題の割合の下限。通り道はつながりの読みのうち盤面の広さを使う読みで、
 * 札で選ばないと数%しか入らない。1手の先読みを求めるレベル4・5 では、通り道の要る候補がさらに少ないので、
 * 当たる割合に近い下限を置く。
 */
const PASSAGE_MINIMUM_SHARE = 0.1;

const tagShareRules = {
  "1": [
    { tag: "corner-opening", maximum: 0.5 },
    { tag: "loop", minimum: 0.4 },
  ],
  "2": [{ tag: "corner-opening", maximum: 0.3 }],
  "3": [
    { tag: "corner-opening", maximum: 0.3 },
    { tag: "passage", minimum: PASSAGE_MINIMUM_SHARE },
  ],
  "4": [
    { tag: "corner-opening", maximum: 0.3 },
    { tag: "passage", minimum: 0.03 },
    { tag: "seven-plus", minimum: 0.15 },
  ],
  "5": [
    { tag: "corner-opening", maximum: 0.3 },
    { tag: "passage", minimum: 0.03 },
    { tag: "seven-plus", minimum: 0.03 },
    { tag: "chained-lookahead", minimum: 0.15 },
    { tag: "deep-lookahead", minimum: 0.06 },
  ],
} as const satisfies Record<BridgesDifficulty, readonly TagShareRule[]>;

function listTags(
  analysis: Extract<BridgesDifficultyAnalysis, { requiresTrial: false }>,
): BridgesProblemTag[] {
  const { reasoning, scale } = analysis;
  return [
    ...(reasoning.cornerOpeningIslandCount > 0
      ? (["corner-opening"] as const)
      : []),
    ...(reasoning.passageRoundCount > 0 ? (["passage"] as const) : []),
    ...(scale.maximumClue >= 7 ? (["seven-plus"] as const) : []),
    ...(scale.loopCount > 0 ? (["loop"] as const) : []),
    ...(reasoning.chainedLookaheadRoundCount > 0
      ? (["chained-lookahead"] as const)
      : []),
    ...(reasoning.lookaheadRoundCount >= 3
      ? (["deep-lookahead"] as const)
      : []),
  ];
}

/**
 * 札の割合の決まりを満たしたまま、`tags` の問題を採れるか。上限のある札は採ると上限を超えるなら採らない。下限のある札は、
 * 採った後の残りの枠で、まだ足りない札の数を埋められるときだけ、その札の無い問題を採る。
 */
function fitsTagShares(
  rules: readonly TagShareRule[],
  counts: ReadonlyMap<BridgesProblemTag, number>,
  taken: number,
  perLevel: number,
  tags: readonly BridgesProblemTag[],
): boolean {
  let shortage = 0;
  for (const { tag, minimum, maximum } of rules) {
    const after = (counts.get(tag) ?? 0) + (tags.includes(tag) ? 1 : 0);
    if (maximum !== undefined && after > Math.floor(maximum * perLevel)) {
      return false;
    }
    if (minimum !== undefined) {
      shortage += Math.max(0, Math.ceil(minimum * perLevel) - after);
    }
  }
  return shortage <= perLevel - (taken + 1);
}

function countTagShortage(
  rules: readonly TagShareRule[],
  counts: ReadonlyMap<BridgesProblemTag, number>,
  perLevel: number,
): string[] {
  return rules.flatMap(({ tag, minimum, maximum }) => {
    const count = counts.get(tag) ?? 0;
    return (minimum !== undefined && count < Math.ceil(minimum * perLevel)) ||
      (maximum !== undefined && count > Math.floor(maximum * perLevel))
      ? [`${tag} ${count}`]
      : [];
  });
}

const defaultBudget = 20_000;

const defaultJobCount = 1;

/**
 * 生成条件を巡回するとき、1つの条件で1問を探して調べる候補の数の上限。届いたら、その条件はその巡では採らずに次の条件へ移る。
 * 札の割合や重複の決まりで当たりにくくなった条件が、ほかの条件で採れる問題を待たせないようにする。
 */
const MAXIMUM_TRIES_PER_TURN = 200;

const usage = `Usage: bun run generate:bridges-pool -- [options]

レベルごとに、レベルの盤面の範囲に入る全生成条件（盤面の一辺 × 島の密度 × 2本の割合 × 輪の割合 × 分割の割合 ×
レベルに当たりやすい磨く回数）で、決定的な seed の候補を番号順に生成・分析・分類する。そのレベルに分類された候補を、
回転・反転（8通り）の同型と、数字を見ない島の配置の重複をレベルをまたいで除き、同じ解く手順の指紋はレベルの問題数の 2% までに
しながら、生成条件を巡回して1問ずつ問題集へ採る。同じ解く手順の指紋は 3問まで、手筋と見せ場の札の割合は
レベルごとの下限・上限を守る。

Options:
  --per-level <n>  レベルごとの問題数 (default: ${defaultPerLevel})
  --budget <n>     生成条件ごとに調べる候補数の上限 (default: ${defaultBudget})
  --jobs <n>       候補を調べる・問題を確かめる子プロセスの数。採る問題と確かめる結果は数に依らない (default: ${defaultJobCount})
  --cache-dir <d>  レベルごとに選んだ結果を <d> に書き出し、あれば読んで続きから作る（途中で止まった生成を再開する）
  --verify         生成せず、同梱の問題集の全問を identity から作り直して盤面の一致を確かめ、一意性確認→分析→分類し、
                   レベル・分析結果・同型と島の配置と seed の重複・指紋の上限・JSON の大きさ・選択時間を確かめる`;

const outputPath = new URL(
  "../src/games/bridges/problem/problem-pool.json",
  import.meta.url,
);

type Candidate = {
  conditions: BridgesGenerationConditions;
  candidateIndex: number;
  milliseconds: number;
  outcome: string;
  difficulty: BridgesDifficulty | null;
  entry: BridgesProblemPoolEntry | null;
  symmetryKey: string;
  layoutKey: string;
  flow: string;
  fingerprint: string;
  tags: BridgesProblemTag[];
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
  islandDensity,
  doubleBridgeRate,
  extraBridgeRate,
  splitRate,
  refinementSteps,
  refinementGoal,
}: BridgesGenerationConditions): string {
  return `${size}×${size}/d${islandDensity}/p${doubleBridgeRate}/e${extraBridgeRate}/s${splitRate}/r${refinementSteps}-${refinementGoal}`;
}

function toPercent(rate: number): number {
  return Math.round(rate * 100);
}

function toPoolEntry(
  conditions: BridgesGenerationConditions,
  candidateIndex: number,
  analysis: Extract<BridgesDifficultyAnalysis, { requiresTrial: false }>,
  board: Parameters<typeof encodeBridgesPoolIslands>[0],
): BridgesProblemPoolEntry {
  const { reasoning, trial, scale } = analysis;
  return [
    conditions.size,
    toPercent(conditions.islandDensity),
    toPercent(conditions.doubleBridgeRate),
    toPercent(conditions.extraBridgeRate),
    toPercent(conditions.splitRate),
    conditions.refinementSteps,
    conditions.refinementGoal,
    candidateIndex,
    encodeBridgesPoolIslands(board),
    encodeBridgesPoolClues(board),
    reasoning.countRoundCount,
    reasoning.connectivityRoundCount,
    Math.round(reasoning.countReasoningUndecidedRatio * scale.edgeCount),
    trial.medianBacktrackCount,
    reasoning.lookaheadRoundCount,
  ];
}

function evaluateCandidate(
  conditions: BridgesGenerationConditions,
  candidateIndex: number,
): Candidate {
  const started = performance.now();
  const identity = createBridgesProblemIdentity(conditions, candidateIndex);
  const { problem, symmetryKey } = generateBridgesProblem(identity);
  const analysis = analyzeBridgesDifficulty(problem);
  const assessment = assessBridgesDifficulty(analysis);
  const classified =
    assessment.status === "classified" &&
    analysis.status === "analyzed" &&
    !analysis.requiresTrial;
  return {
    conditions,
    candidateIndex,
    milliseconds: performance.now() - started,
    outcome:
      assessment.status === "classified"
        ? `L${assessment.difficulty}`
        : assessment.status === "out-of-range"
          ? assessment.reason
          : assessment.status,
    difficulty: classified ? assessment.difficulty : null,
    entry: classified
      ? toPoolEntry(conditions, candidateIndex, analysis, problem)
      : null,
    symmetryKey,
    layoutKey: getBridgesLayoutKey(problem),
    flow: classified ? describeBridgesSolveFlow(problem) : "",
    fingerprint: classified ? describeBridgesSolveFingerprint(problem) : "",
    tags: classified ? listTags(analysis) : [],
  };
}

/** `--worker` で起動された子プロセス: 渡された生成条件と候補番号の範囲を順に調べ、1候補1行の JSON で書き出す。 */
function runWorker(argument: string): void {
  const jobs = JSON.parse(argument) as {
    conditions: BridgesGenerationConditions;
    start: number;
    count: number;
  }[];
  for (const { conditions, start, count } of jobs) {
    for (let index = start; index < start + count; index += 1) {
      console.log(JSON.stringify(evaluateCandidate(conditions, index)));
    }
  }
}

type CandidateJob = {
  conditionIndex: number;
  conditions: BridgesGenerationConditions;
  start: number;
  count: number;
};

/** 候補の調べを `jobCount` 個の子プロセスに分けて走らせ、生成条件ごとに候補番号の順で返す。 */
async function evaluateInParallel(
  jobs: readonly CandidateJob[],
  jobCount: number,
): Promise<Map<number, Candidate[]>> {
  const pieces = jobs.flatMap((job) =>
    Array.from({ length: job.count }, (_, offset) => ({
      ...job,
      start: job.start + offset,
      count: 1,
    })),
  );
  const shards = Array.from({ length: jobCount }, (_, shard) =>
    pieces.filter((_, index) => index % jobCount === shard),
  ).filter((shard) => shard.length > 0);
  const outputs = await Promise.all(
    shards.map(async (shard) => {
      const worker = Bun.spawn(
        [
          process.execPath,
          Bun.fileURLToPath(import.meta.url),
          "--worker",
          JSON.stringify(
            shard.map(({ conditions, start, count }) => ({
              conditions,
              start,
              count,
            })),
          ),
        ],
        { stdout: "pipe", stderr: "inherit" },
      );
      const output = await new Response(worker.stdout).text();
      if ((await worker.exited) !== 0) {
        throw new Error("A candidate worker failed");
      }
      return output
        .trim()
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as Candidate);
    }),
  );
  const byCondition = new Map<number, Candidate[]>();
  const conditionIndexOf = new Map(
    jobs.map((job) => [conditionKeyOf(job.conditions), job.conditionIndex]),
  );
  for (const candidate of outputs.flat()) {
    const conditionIndex = conditionIndexOf.get(
      conditionKeyOf(candidate.conditions),
    )!;
    const list = byCondition.get(conditionIndex) ?? [];
    list.push(candidate);
    byCondition.set(conditionIndex, list);
  }
  for (const list of byCondition.values()) {
    list.sort((left, right) => left.candidateIndex - right.candidateIndex);
  }
  return byCondition;
}

function quantile(sorted: readonly number[], ratio: number): number {
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, sorted.length - 1);
  return (
    sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower)
  );
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

function formatCounts(values: readonly (string | number)[]): string {
  const counts = new Map<string | number, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts]
    .sort(([left], [right]) => String(left).localeCompare(String(right)))
    .map(([value, count]) => `${value}:${count}`)
    .join(" ");
}

function formatPoolJson(
  levels: Record<BridgesDifficulty, readonly BridgesProblemPoolEntry[]>,
): string {
  const levelLines = difficultyLevels.map(({ id }, index) => {
    const entries = levels[id].map((entry) => `      ${JSON.stringify(entry)}`);
    const separator = index === difficultyLevels.length - 1 ? "" : ",";
    return `    "${id}": [\n${entries.join(",\n")}\n    ]${separator}`;
  });
  return `{\n  "generatorVersion": ${JSON.stringify(BRIDGES_GENERATOR_VERSION)},\n  "levels": {\n${levelLines.join("\n")}\n  }\n}\n`;
}

function describeSize(json: string): string {
  const bytes = Buffer.byteLength(json);
  return `${(bytes / 1024).toFixed(1)} KiB（gzip ${(gzipSync(json).length / 1024).toFixed(1)} KiB）`;
}

/** 問題集の1問の、分布を見る値。 */
function describeEntries(
  difficulty: BridgesDifficulty,
  entries: readonly BridgesProblemPoolEntry[],
): string[] {
  const pooled = entries.map(toBridgesPooledProblem);
  const edgeCounts = pooled.map(
    ({ problem }) => getBridgesNetwork(problem).edges.length,
  );
  return [
    `L${difficulty}: ${entries.length}問`,
    `  盤面の一辺 ${formatCounts(entries.map(([size]) => size))}`,
    `  島の密度(%) ${formatCounts(entries.map((entry) => entry[1]))} / 2本(%) ${formatCounts(entries.map((entry) => entry[2]))} / 輪(%) ${formatCounts(entries.map((entry) => entry[3]))} / 分割(%) ${formatCounts(entries.map((entry) => entry[4]))} / 磨く ${formatCounts(entries.map((entry) => `${entry[5]}-${entry[6]}`))}`,
    `  島の数 ${describeDistribution(pooled.map(({ problem }) => problem.islands.length))}`,
    `  行き先の数 ${describeDistribution(edgeCounts)}`,
    `  A2 の手詰まり ${describeDistribution(pooled.map(({ analysis }) => analysis.countRoundCount))}`,
    `  つながりの手詰まり ${describeDistribution(pooled.map(({ analysis }) => analysis.connectivityRoundCount))}`,
    `  数字だけで決まらない割合 ${describeDistribution(
      pooled.map(
        ({ analysis }, index) =>
          analysis.countReasoningUndecidedEdgeCount / edgeCounts[index]!,
      ),
      2,
    )}`,
    `  N2 戻し ${describeDistribution(pooled.map(({ analysis }) => analysis.trialBacktrackCount))}`,
  ];
}

type LevelSelection = {
  entries: BridgesProblemPoolEntry[];
  candidateCount: number;
  outcomes: Map<string, number>;
  milliseconds: number[];
};

/**
 * 生成条件ごとに先に調べておく候補の数。どれかの条件の手持ちが尽きたら、手持ちがこの数に満たない条件をまとめて
 * この数ずつ足して子プロセスに配る。磨く回数の多い条件は1候補が重いので少なくする。
 */
function getLookaheadBatchSize({
  refinementSteps,
}: BridgesGenerationConditions): number {
  return refinementSteps >= 1500 ? 2 : 8;
}

/**
 * 1つのレベルの問題を採る。生成条件を巡回し、各条件で次に当たる候補（候補番号の順）を1問ずつ採る。
 * 回転・反転で同じ形の問題と、島の配置が同じ問題は、別のレベルで採ったものも含めて除く。同じ流れ・同じ指紋の問題の数と、
 * 札の割合（`tagShareRules`）を守る。候補の調べは子プロセスに分けて先に走らせ、採る順は1プロセスで調べたときと同じにする。
 */
async function selectLevel(
  difficulty: BridgesDifficulty,
  perLevel: number,
  budget: number,
  jobCount: number,
  takenKeys: Set<string>,
  takenLayouts: Set<string>,
): Promise<LevelSelection> {
  const flowCounts = new Map<string, number>();
  const fingerprintCounts = new Map<string, number>();
  const tagCounts = new Map<BridgesProblemTag, number>();
  const rules: readonly TagShareRule[] = tagShareRules[difficulty];
  const flowLimit = getFlowLimit(perLevel);
  const conditions = listBridgesGenerationConditions(difficulty);
  const nextIndex = conditions.map(() => 0);
  const evaluatedUntil = conditions.map(() => 0);
  const buffers = conditions.map((): Candidate[] => []);
  const exhausted = conditions.map(() => false);
  const selection: LevelSelection = {
    entries: [],
    candidateCount: 0,
    outcomes: new Map(),
    milliseconds: [],
  };
  async function fillBuffers(): Promise<void> {
    const jobs = conditions.flatMap((condition, conditionIndex) => {
      const batchSize = getLookaheadBatchSize(condition);
      if (
        exhausted[conditionIndex] ||
        buffers[conditionIndex]!.length >= batchSize
      ) {
        return [];
      }
      const start = evaluatedUntil[conditionIndex]!;
      const count = Math.min(batchSize, budget - start);
      return count > 0
        ? [{ conditionIndex, conditions: condition, start, count }]
        : [];
    });
    if (jobs.length === 0) {
      return;
    }
    const results = await evaluateInParallel(jobs, jobCount);
    for (const job of jobs) {
      buffers[job.conditionIndex]!.push(
        ...(results.get(job.conditionIndex) ?? []),
      );
      evaluatedUntil[job.conditionIndex]! += job.count;
    }
  }
  while (selection.entries.length < perLevel) {
    if (exhausted.every(Boolean)) {
      throw new Error(
        `Level ${difficulty} ran out of candidates at ${selection.entries.length} problems (${countTagShortage(rules, tagCounts, perLevel).join(", ")})`,
      );
    }
    for (const [conditionIndex] of conditions.entries()) {
      if (selection.entries.length >= perLevel || exhausted[conditionIndex]) {
        continue;
      }
      for (let tries = 0; tries < MAXIMUM_TRIES_PER_TURN; tries += 1) {
        if (nextIndex[conditionIndex]! >= budget) {
          exhausted[conditionIndex] = true;
          break;
        }
        if (buffers[conditionIndex]!.length === 0) {
          await fillBuffers();
        }
        const candidate = buffers[conditionIndex]!.shift()!;
        nextIndex[conditionIndex]! += 1;
        selection.candidateCount += 1;
        selection.milliseconds.push(candidate.milliseconds);
        selection.outcomes.set(
          candidate.outcome,
          (selection.outcomes.get(candidate.outcome) ?? 0) + 1,
        );
        if (
          candidate.difficulty === difficulty &&
          candidate.entry !== null &&
          !takenKeys.has(candidate.symmetryKey) &&
          !takenLayouts.has(candidate.layoutKey) &&
          (flowCounts.get(candidate.flow) ?? 0) < flowLimit &&
          (fingerprintCounts.get(candidate.fingerprint) ?? 0) <
            FINGERPRINT_LIMIT &&
          fitsTagShares(
            rules,
            tagCounts,
            selection.entries.length,
            perLevel,
            candidate.tags,
          )
        ) {
          takenKeys.add(candidate.symmetryKey);
          takenLayouts.add(candidate.layoutKey);
          flowCounts.set(
            candidate.flow,
            (flowCounts.get(candidate.flow) ?? 0) + 1,
          );
          fingerprintCounts.set(
            candidate.fingerprint,
            (fingerprintCounts.get(candidate.fingerprint) ?? 0) + 1,
          );
          for (const tag of candidate.tags) {
            tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
          }
          selection.entries.push(candidate.entry);
          console.log(
            `L${difficulty}: ${selection.entries.length}/${perLevel}（候補 ${selection.candidateCount}・札 ${[
              ...tagCounts,
            ]
              .map(([tag, count]) => `${tag} ${count}`)
              .join(" ")}）`,
          );
          break;
        }
      }
    }
  }
  console.log(
    `L${difficulty}: 条件 ${conditions.length} 個で候補 ${selection.candidateCount} を調べた（${conditions
      .map(
        (condition, index) =>
          `${conditionKeyOf(condition)}=${nextIndex[index]}`,
      )
      .join(" ")}）`,
  );
  return selection;
}

/** 途中で止まっても選び終えたレベルから続けられるよう、レベルごとの選んだ結果を書き出す。 */
function writeCachedSelection(path: string, selection: LevelSelection): void {
  writeFileSync(
    path,
    JSON.stringify({ ...selection, outcomes: [...selection.outcomes] }),
  );
}

/** 書き出したレベルの選んだ結果を読み、そのレベルの問題の同型と島の配置を、後のレベルで除くために覚える。 */
function readCachedSelection(
  path: string,
  takenKeys: Set<string>,
  takenLayouts: Set<string>,
): LevelSelection {
  const cached = JSON.parse(readFileSync(path, "utf8")) as Omit<
    LevelSelection,
    "outcomes"
  > & { outcomes: [string, number][] };
  for (const entry of cached.entries) {
    const { problem } = toBridgesPooledProblem(entry);
    takenKeys.add(getBridgesSymmetryKey(problem));
    takenLayouts.add(getBridgesLayoutKey(problem));
  }
  console.log(`${path} から選んだ ${cached.entries.length} 問を読んだ`);
  return { ...cached, outcomes: new Map(cached.outcomes) };
}

async function runMain(): Promise<void> {
  const perLevel = readPositiveInteger("per-level", defaultPerLevel);
  const budget = readPositiveInteger("budget", defaultBudget);
  const jobCount = readPositiveInteger("jobs", defaultJobCount);
  const started = performance.now();
  const cacheDirectory = readOption("cache-dir");
  if (cacheDirectory !== undefined) {
    mkdirSync(cacheDirectory, { recursive: true });
  }
  const takenKeys = new Set<string>();
  const takenLayouts = new Set<string>();
  const levels = {} as Record<BridgesDifficulty, BridgesProblemPoolEntry[]>;
  const selections: { id: BridgesDifficulty; selection: LevelSelection }[] = [];
  for (const { id } of difficultyLevels) {
    const cachePath =
      cacheDirectory === undefined
        ? undefined
        : `${cacheDirectory}/level-${id}-${perLevel}.json`;
    const selection =
      cachePath !== undefined && existsSync(cachePath)
        ? readCachedSelection(cachePath, takenKeys, takenLayouts)
        : await selectLevel(
            id,
            perLevel,
            budget,
            jobCount,
            takenKeys,
            takenLayouts,
          );
    if (cachePath !== undefined) {
      writeCachedSelection(cachePath, selection);
    }
    levels[id] = selection.entries;
    selections.push({ id, selection });
  }
  const json = formatPoolJson(levels);
  writeFileSync(outputPath, json);

  console.log(
    `\n${((performance.now() - started) / 1_000).toFixed(1)} 秒で生成。${describeSize(json)}`,
  );
  for (const { id, selection } of selections) {
    const times = [...selection.milliseconds].sort((a, b) => a - b);
    console.log(
      `L${id}: 候補 ${selection.candidateCount}・採用率 ${((selection.entries.length / selection.candidateCount) * 100).toFixed(1)}%・1候補 p50 ${quantile(times, 0.5).toFixed(1)}ms p95 ${quantile(times, 0.95).toFixed(1)}ms・内訳 ${formatCounts(
        [...selection.outcomes].flatMap(([outcome, count]) =>
          Array.from({ length: count }, () => outcome),
        ),
      )}`,
    );
  }
  console.log("\n分布（最小 / 10 / 50 / 90 / 最大）");
  for (const { id } of difficultyLevels) {
    console.log(describeEntries(id, levels[id]).join("\n"));
  }
}

type VerifyFailure = {
  difficulty: BridgesDifficulty;
  index: number;
  reason: string;
};

function verifyEntry(
  difficulty: BridgesDifficulty,
  entry: BridgesProblemPoolEntry,
): { reason: string | null; tags: BridgesProblemTag[] } {
  const pooled = toBridgesPooledProblem(entry);
  const regenerated = generateBridgesProblem(pooled.identity);
  if (
    formatBridgesBoard(regenerated.problem).join("/") !==
    formatBridgesBoard(pooled.problem).join("/")
  ) {
    return { reason: "identity から作り直した盤面が違う", tags: [] };
  }
  const analysis = analyzeBridgesDifficulty(pooled.problem);
  if (analysis.status !== "analyzed") {
    return { reason: `分析の状態が ${analysis.status}`, tags: [] };
  }
  const assessment = assessBridgesDifficulty(analysis);
  if (
    assessment.status !== "classified" ||
    assessment.difficulty !== difficulty ||
    analysis.requiresTrial
  ) {
    return {
      reason: `分類が L${difficulty} でない（${assessment.status === "classified" ? `L${assessment.difficulty}` : assessment.status}）`,
      tags: [],
    };
  }
  const expected = toPoolEntry(
    pooled.identity.conditions,
    entry[7],
    analysis,
    pooled.problem,
  );
  if (
    JSON.stringify(toBridgesPoolAnalysis(expected)) !==
    JSON.stringify(pooled.analysis)
  ) {
    return { reason: "分析結果が問題集の値と違う", tags: listTags(analysis) };
  }
  return { reason: null, tags: listTags(analysis) };
}

function measureSelection(): string {
  const started = performance.now();
  const count = 2_000;
  for (let index = 0; index < count; index += 1) {
    const { id } = difficultyLevels[index % difficultyLevels.length]!;
    selectBridgesProblemForDifficulty(id, `verify-${index}`);
  }
  return `${((performance.now() - started) / count).toFixed(3)}ms/問`;
}

type VerifiedEntry = { reason: string | null; tags: BridgesProblemTag[] };

/** `--verify-worker` で起動された子プロセス: 渡された難易度と番号の問題を確かめ、1問1行の JSON で書き出す。 */
function runVerifyWorker(argument: string): void {
  const targets = JSON.parse(argument) as [BridgesDifficulty, number][];
  for (const [difficulty, index] of targets) {
    const entry = listBridgesPoolEntries(difficulty)[index]!;
    console.log(
      JSON.stringify([difficulty, index, verifyEntry(difficulty, entry)]),
    );
  }
}

/** 問題集の全問の確かめ（`verifyEntry`）を `jobCount` 個の子プロセスに分けて走らせる。 */
async function verifyInParallel(
  jobCount: number,
): Promise<Map<string, VerifiedEntry>> {
  const targets = difficultyLevels.flatMap(({ id }) =>
    listBridgesPoolEntries(id).map((_, index): [BridgesDifficulty, number] => [
      id,
      index,
    ]),
  );
  const shards = Array.from({ length: jobCount }, (_, shard) =>
    targets.filter((_, index) => index % jobCount === shard),
  ).filter((shard) => shard.length > 0);
  const outputs = await Promise.all(
    shards.map(async (shard) => {
      const worker = Bun.spawn(
        [
          process.execPath,
          Bun.fileURLToPath(import.meta.url),
          "--verify-worker",
          JSON.stringify(shard),
        ],
        { stdout: "pipe", stderr: "inherit" },
      );
      const output = await new Response(worker.stdout).text();
      if ((await worker.exited) !== 0) {
        throw new Error("A verify worker failed");
      }
      return output
        .trim()
        .split("\n")
        .filter((line) => line.length > 0)
        .map(
          (line) =>
            JSON.parse(line) as [BridgesDifficulty, number, VerifiedEntry],
        );
    }),
  );
  return new Map(
    outputs
      .flat()
      .map(([difficulty, index, verified]) => [
        `${difficulty}:${index}`,
        verified,
      ]),
  );
}

async function runVerify(): Promise<void> {
  const started = performance.now();
  const verified = await verifyInParallel(
    readPositiveInteger("jobs", defaultJobCount),
  );
  const failures: VerifyFailure[] = [];
  const keys = new Map<string, string>();
  const layouts = new Set<string>();
  const seeds = new Set<string>();
  let duplicateCount = 0;
  let layoutDuplicateCount = 0;
  let seedDuplicateCount = 0;
  let fingerprintExcessCount = 0;
  let tagShareViolationCount = 0;
  for (const { id } of difficultyLevels) {
    const entries = listBridgesPoolEntries(id);
    const flowCounts = new Map<string, number>();
    const fingerprintCounts = new Map<string, number>();
    for (const entry of entries) {
      const { problem } = toBridgesPooledProblem(entry);
      const flow = describeBridgesSolveFlow(problem);
      flowCounts.set(flow, (flowCounts.get(flow) ?? 0) + 1);
      const fingerprint = describeBridgesSolveFingerprint(problem);
      fingerprintCounts.set(
        fingerprint,
        (fingerprintCounts.get(fingerprint) ?? 0) + 1,
      );
    }
    const flowLimit = getFlowLimit(entries.length);
    fingerprintExcessCount +=
      [...flowCounts.values()].filter((count) => count > flowLimit).length +
      [...fingerprintCounts.values()].filter(
        (count) => count > FINGERPRINT_LIMIT,
      ).length;
    console.log(
      `L${id}: 解く手順の流れ ${flowCounts.size} 種類（最多 ${Math.max(...flowCounts.values())} 問、上限 ${flowLimit} 問）・指紋 ${fingerprintCounts.size} 種類（最多 ${Math.max(...fingerprintCounts.values())} 問、上限 ${FINGERPRINT_LIMIT} 問）`,
    );
    const tagCounts = new Map<BridgesProblemTag, number>();
    for (const [index, entry] of entries.entries()) {
      const { reason, tags } = verified.get(`${id}:${index}`)!;
      if (reason !== null) {
        failures.push({ difficulty: id, index, reason });
      }
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
      const pooled = toBridgesPooledProblem(entry);
      const key = getBridgesSymmetryKey(pooled.problem);
      if (keys.has(key)) {
        duplicateCount += 1;
      }
      keys.set(key, `L${id}#${index}`);
      const layoutKey = getBridgesLayoutKey(pooled.problem);
      if (layouts.has(layoutKey)) {
        layoutDuplicateCount += 1;
      }
      layouts.add(layoutKey);
      if (seeds.has(pooled.identity.seed)) {
        seedDuplicateCount += 1;
      }
      seeds.add(pooled.identity.seed);
    }
    const shortage = countTagShortage(
      tagShareRules[id],
      tagCounts,
      entries.length,
    );
    tagShareViolationCount += shortage.length;
    console.log(
      `L${id}: 札 ${[...tagCounts].map(([tag, count]) => `${tag} ${count}`).join("・")}${shortage.length > 0 ? `（割合の決まりを外れた札: ${shortage.join("・")}）` : ""}`,
    );
  }
  const json = JSON.stringify(
    Object.fromEntries(
      difficultyLevels.map(({ id }) => [id, listBridgesPoolEntries(id)]),
    ),
  );
  console.log(
    `全 ${seeds.size + seedDuplicateCount} 問を ${((performance.now() - started) / 1_000).toFixed(1)} 秒で確かめた`,
  );
  for (const { id } of difficultyLevels) {
    console.log(`L${id}: ${listBridgesPoolEntries(id).length}問`);
  }
  console.log(
    `同型の重複 ${duplicateCount}・島の配置の重複 ${layoutDuplicateCount}・seed の重複 ${seedDuplicateCount}・流れと指紋の上限超え ${fingerprintExcessCount}・札の割合の外れ ${tagShareViolationCount}`,
  );
  console.log(
    `問題集の大きさ（項目だけ）${describeSize(json)}・選択 ${measureSelection()}`,
  );
  console.log("\n分布（最小 / 10 / 50 / 90 / 最大）");
  for (const { id } of difficultyLevels) {
    console.log(describeEntries(id, listBridgesPoolEntries(id)).join("\n"));
  }
  if (
    failures.length > 0 ||
    duplicateCount > 0 ||
    layoutDuplicateCount > 0 ||
    seedDuplicateCount > 0 ||
    fingerprintExcessCount > 0 ||
    tagShareViolationCount > 0
  ) {
    for (const failure of failures.slice(0, 20)) {
      console.error(
        `L${failure.difficulty}#${failure.index}: ${failure.reason}`,
      );
    }
    throw new Error(
      `Bridges problem pool verification failed: ${failures.length} entries, ${duplicateCount} symmetric duplicates, ${layoutDuplicateCount} layout duplicates, ${seedDuplicateCount} seed duplicates, ${fingerprintExcessCount} flows or fingerprints over the limit, ${tagShareViolationCount} tag share violations`,
    );
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
