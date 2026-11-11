import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
import { measureBridgesSolveWorkload } from "@/games/bridges/problem/workload";
import { selectBridgesProblemForDifficulty } from "@/games/bridges/problem-selection";
import {
  formatBridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import { calculateBridgesSpeedFullScoreMs } from "@/games/bridges/score";
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

/** 解く手順の始まりとみなす手詰まりの数。 */
const OPENING_ROUND_COUNT = 3;

/** 1つのレベルで、解く手順の始まり（最初の `OPENING_ROUND_COUNT` 回の手詰まり）が同じ問題の数の上限（問題数に対する割合）。 */
const MAXIMUM_OPENING_SHARE = 0.05;

function getOpeningLimit(perLevel: number): number {
  return Math.max(1, Math.ceil(perLevel * MAXIMUM_OPENING_SHARE));
}

/**
 * 1つのレベルで、始まりの形（最初の `OPENING_ROUND_COUNT` 回の手詰まりの、段と読む数字の組と外周に沿うか）が同じ問題の数の
 * 上限（問題数に対する割合）。流れが違っても、同じ数字の並びから同じ手で始まる問題が並ばないようにする。
 */
const MAXIMUM_OPENING_SHAPE_SHARE = 0.02;

function getOpeningShapeLimit(perLevel: number): number {
  return Math.max(1, Math.ceil(perLevel * MAXIMUM_OPENING_SHAPE_SHARE));
}

/**
 * 島の配置が近いとみなす、回転・反転をそろえて位置の違う島の数（どちらか一方にだけある島の数）の上限の、島の数に対する割合。
 * 島20前後の盤面では2島、島10前後のレベル1 では1島。島の少ない盤面で2島違いまで同じとみなすと、6×6・7×7 の配置が尽きる。
 */
const NEAR_LAYOUT_SHARE = 0.1;

function getNearLayoutDifference(islandCount: number): number {
  return Math.max(1, Math.floor(islandCount * NEAR_LAYOUT_SHARE));
}

/**
 * 問題の手筋と見せ場の札。レベルの中で、札のある問題の割合に下限・上限を置き、どのレベルにも同じ形の問題が並ばないようにする。
 * - `corner-opening`: 盤面の四隅の島の決め打ちがある（どの盤面でも同じ始まりになりやすい）。レベル1 の 6×6 は、決め打ちの島の
 *   多くが四隅になるので、上限を半分にする。
 * - `passage`: 唯一の通り道の読みが要る。
 * - `seven-plus`: 7 か 8 の島がある。
 * - `loop`: 解に輪がある。
 * - `chained-lookahead`: 1手の先読みの結果から、すぐ次の1手の先読みが要る。
 * - `deep-lookahead`: 1手の先読みが3回以上要る。
 * - `capping-lookahead`: 架けすぎる手を退けて上限を下げる1手の先読みが要る。
 * - `isolating-lookahead`: 数島のまとまりが孤立するのを見て退ける1手の先読みが要る。
 * - `reading-capping-lookahead`: 架けすぎる手を本数の破れか組の閉じるので退けて上限を下げる1手の先読みが要る。
 * - `eight`: 8 の島がある（4方向に2本ずつ）。
 * - `point-symmetric`: 島の配置が点対称。
 */
type BridgesProblemTag =
  | "corner-opening"
  | "passage"
  | "seven-plus"
  | "loop"
  | "chained-lookahead"
  | "deep-lookahead"
  | "capping-lookahead"
  | "isolating-lookahead"
  | "reading-capping-lookahead"
  | "eight"
  | "point-symmetric";

type TagShareRule = {
  tag: BridgesProblemTag;
  minimum?: number;
  maximum?: number;
};

/**
 * L3〜L5 で、唯一の通り道の読みが要る問題の割合の下限。通り道は盤面の広さを使うつながりの読みで、札で選ばないと上のレベルほど
 * 少なくなる（判定の版 7 で L3 15%・L4 12%・L5 8%）。生成器の版 7 の候補で、各レベルに当たった問題のうち通り道の要るものは
 * 1割前後で（一時スクリプト）、評価役の案の 25% は残りの枠が埋まらない。
 */
const PASSAGE_MINIMUM_SHARE = 0.1;

/** L3〜L5 で、点対称の配置の問題の割合の下限と上限。対称の盤面は見た目の見せ場だが、多いと同じ形に見える。 */
const POINT_SYMMETRIC_SHARE = { minimum: 0.1, maximum: 0.2 } as const;

/**
 * 8 の島（4方向に2本ずつ）がある問題の割合の下限。当たった問題の 1割前後にしか出ず（一時スクリプト）、評価役の案（1割）は
 * 残りの枠が埋まらないので、出る割合より低い下限にする。
 */
const EIGHT_MINIMUM_SHARE = 0.05;

/**
 * L4 と L5 を分ける、問題を解き切る作業の量（速さ満点の基準時間）の境。L4 はこれ以下、L5 はこれより長い問題だけを採る。
 * 先読みの場所の数で分けても、島の数・橋・読みの手詰まりの多い L4 は、作業の量が L5 の少ない問題を上回る。上のレベルの
 * 作業の量が下のレベルを必ず上回るよう、境で分ける。
 */
const LOOKAHEAD_LEVEL_WORKLOAD_BOUNDARY_MS = 300_000;

function fitsWorkload(
  difficulty: BridgesDifficulty,
  entry: BridgesProblemPoolEntry,
): boolean {
  const fullScoreMs = calculateBridgesSpeedFullScoreMs(
    measureBridgesSolveWorkload(toBridgesPooledProblem(entry)),
  );
  switch (difficulty) {
    case "4":
      return fullScoreMs <= LOOKAHEAD_LEVEL_WORKLOAD_BOUNDARY_MS;
    case "5":
      return fullScoreMs > LOOKAHEAD_LEVEL_WORKLOAD_BOUNDARY_MS;
    default:
      return true;
  }
}

const tagShareRules = {
  "1": [
    { tag: "corner-opening", maximum: 0.5 },
    { tag: "loop", minimum: 0.5 },
  ],
  "2": [{ tag: "corner-opening", maximum: 0.3 }],
  "3": [
    { tag: "corner-opening", maximum: 0.3 },
    { tag: "passage", minimum: PASSAGE_MINIMUM_SHARE },
    { tag: "eight", minimum: EIGHT_MINIMUM_SHARE },
    { tag: "point-symmetric", ...POINT_SYMMETRIC_SHARE },
  ],
  "4": [
    { tag: "corner-opening", maximum: 0.3 },
    { tag: "passage", minimum: PASSAGE_MINIMUM_SHARE },
    { tag: "seven-plus", minimum: 0.15 },
    { tag: "eight", minimum: EIGHT_MINIMUM_SHARE },
    { tag: "isolating-lookahead", minimum: 0.05 },
    { tag: "point-symmetric", ...POINT_SYMMETRIC_SHARE },
  ],
  "5": [
    { tag: "corner-opening", maximum: 0.3 },
    { tag: "passage", minimum: PASSAGE_MINIMUM_SHARE },
    { tag: "seven-plus", minimum: 0.15 },
    { tag: "eight", minimum: EIGHT_MINIMUM_SHARE },
    { tag: "isolating-lookahead", minimum: 0.08 },
    { tag: "point-symmetric", ...POINT_SYMMETRIC_SHARE },
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
    ...(reasoning.cappingLookaheadRoundCount > 0
      ? (["capping-lookahead"] as const)
      : []),
    ...(reasoning.isolatingLookaheadRoundCount > 0
      ? (["isolating-lookahead"] as const)
      : []),
    ...(reasoning.readingCappingLookaheadRoundCount > 0
      ? (["reading-capping-lookahead"] as const)
      : []),
    ...(scale.maximumClue === 8 ? (["eight"] as const) : []),
    ...(scale.pointSymmetric === 1 ? (["point-symmetric"] as const) : []),
  ];
}

/**
 * 札の割合の決まりを満たしたまま、`tags` の問題を採れるか。上限のある札は採ると上限を超えるなら採らない。下限のある札は、
 * 採った後の残りの枠で、まだ足りない札の数を埋められるときだけ、その札の無い問題を採る。
 */
/** 生成条件から必ず付く札。点対称の生成条件の候補は、どれも島の配置が点対称になる。 */
function listConditionTags(
  conditions: BridgesGenerationConditions,
): BridgesProblemTag[] {
  return conditions.layoutSymmetry === "point" ? ["point-symmetric"] : [];
}

/** 生成条件から必ず付く札のどれかが上限に届いていて、その条件の候補をもう採れないか。 */
function isConditionCapped(
  rules: readonly TagShareRule[],
  counts: ReadonlyMap<BridgesProblemTag, number>,
  perLevel: number,
  conditions: BridgesGenerationConditions,
): boolean {
  return listConditionTags(conditions).some((tag) =>
    rules.some(
      (rule) =>
        rule.tag === tag &&
        rule.maximum !== undefined &&
        (counts.get(tag) ?? 0) >= Math.floor(rule.maximum * perLevel),
    ),
  );
}

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
 * 生成条件を巡回するとき、1つの条件で1問を探して調べる候補の数の上限。届いたら、その条件はその巡では採らずに次の条件へ移り、
 * 続けて届いた回数を k として、その後 2^k 巡のあいだその条件を飛ばす。札の割合や重複の決まりで当たりにくくなった条件
 * （島の配置が近い問題で埋まった 6×6 など）が、ほかの条件で採れる問題を待たせないようにする。
 */
const MAXIMUM_TRIES_PER_TURN = 200;

/**
 * 1問を採るまでに調べた候補がこの数を超えるごとに、その条件を1巡飛ばす。当たりにくい条件（L4 の 9×9 など）を巡ごとに
 * 調べ続けると、当たりやすい条件の何倍もの候補を使うので、条件ごとに1問あたりに使う候補の数をそろえる。
 */
const TRIES_PER_SKIPPED_TURN = 20;

const usage = `Usage: bun run generate:bridges-pool -- [options]

レベルごとに、レベルの盤面の範囲に入る全生成条件（盤面の一辺 × 島の数 × 2本の割合 × 輪の割合 × 分割の割合 ×
レベルに当たりやすい磨く回数と向き × L3〜L5 は点対称の配置）で、決定的な seed の候補を番号順に生成・分析・分類する。
そのレベルに分類された候補を、回転・反転（8通り）の同型と、島の配置が近い問題（位置の違う島が島の数の1割以下、少なくとも1つ）をレベルをまたいで
除き、同じ解く手順の流れは問題数の 2%、始まり（最初の3回の手詰まり）は 5%、始まりの形（最初の3回の指紋）は 2%、
指紋は3問までにし、手筋と見せ場の札の割合のレベルごとの下限・上限を
守りながら、生成条件を巡回して1問ずつ問題集へ採る。

Options:
  --per-level <n>  レベルごとの問題数 (default: ${defaultPerLevel})
  --budget <n>     生成条件ごとに調べる候補数の上限 (default: ${defaultBudget})
  --jobs <n>       候補を調べる・問題を確かめる子プロセスの数。採る問題と確かめる結果は数に依らない (default: ${defaultJobCount})
  --cache-dir <d>  レベルごとに選んだ結果と、選んでいる途中の状態を <d> に書き出し、あれば読んで続きから作る
                   （途中で止まった生成を、レベルの途中から同じ順で再開する）
  --verify         生成せず、同梱の問題集の全問を identity から作り直して盤面の一致を確かめ、一意性確認→分析→分類し、
                   レベル・分析結果・同型と島の配置の重複と近さと seed の重複・流れと始まりと指紋の上限・札の割合・
                   JSON の大きさ・選択時間を確かめる`;

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
  opening: string;
  openingShape: string;
  fingerprint: string;
  cells: number[];
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
  layoutSymmetry,
}: BridgesGenerationConditions): string {
  return `${size}×${size}/d${islandDensity}/p${doubleBridgeRate}/e${extraBridgeRate}/s${splitRate}/r${refinementSteps}-${refinementGoal}${layoutSymmetry === "point" ? "-pt" : ""}`;
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
    reasoning.crossingBlockCount,
    conditions.layoutSymmetry === "point" ? 1 : 0,
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
    opening: classified
      ? describeOpening(describeBridgesSolveFlow(problem))
      : "",
    cells: problem.islands.map(
      ({ row, column }) => row * problem.width + column,
    ),
    fingerprint: classified ? describeBridgesSolveFingerprint(problem) : "",
    openingShape: classified
      ? describeOpening(describeBridgesSolveFingerprint(problem))
      : "",
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
 * 生成条件ごとに先に調べておく候補の数。どれかの条件の手持ちが尽きたら、その条件には `getDrainedBatchPerJob` に子プロセスの
 * 数を掛けた数を、手持ちがこの数に満たないほかの条件にはこの数ずつを足して、まとめて子プロセスに配る。磨く回数の多い条件は
 * 1候補が重いので少なくする。
 */
/**
 * 手持ちが尽きた条件に、子プロセス1つあたりに足す候補の数。尽きた条件は続けて調べることが多く、1〜2候補ずつ子プロセスを
 * 起こすと、起動の時間が調べる時間を上回り、子プロセスも揃って動かない。磨く回数の少ない条件は1候補が軽いので多く配る。
 */
function getDrainedBatchPerJob({
  refinementSteps,
}: BridgesGenerationConditions): number {
  if (refinementSteps <= 150) {
    return 64;
  }
  return refinementSteps <= 500 ? 24 : 8;
}

function getLookaheadBatchSize({
  refinementSteps,
}: BridgesGenerationConditions): number {
  return refinementSteps >= 1500 ? 2 : 8;
}

/** 解く手順の流れか指紋の、最初の `OPENING_ROUND_COUNT` 回の手詰まり。 */
function describeOpening(flow: string): string {
  return flow.split(",").slice(0, OPENING_ROUND_COUNT).join(",");
}

/** 島の位置（行 × 一辺 + 列）の、回転・反転した8通り。 */
function listLayoutVariants(
  size: number,
  cells: readonly number[],
): Set<number>[] {
  const transforms = [
    (row: number, column: number) => [row, column],
    (row: number, column: number) => [column, size - 1 - row],
    (row: number, column: number) => [size - 1 - row, size - 1 - column],
    (row: number, column: number) => [size - 1 - column, row],
  ] as const;
  return transforms.flatMap((transform) =>
    [false, true].map(
      (flips) =>
        new Set(
          cells.map((cell) => {
            const row = Math.floor(cell / size);
            const column = cell % size;
            const [toRow, toColumn] = transform(
              row,
              flips ? size - 1 - column : column,
            );
            return toRow! * size + toColumn!;
          }),
        ),
    ),
  );
}

/**
 * 問題集に採った問題。回転・反転で同じ形の問題と、島の配置が近い問題（回転・反転をそろえて、位置の違う島が
 * `getNearLayoutDifference` 以下）を、レベルをまたいで除くのに使う。
 */
class TakenProblems {
  readonly keys = new Set<string>();
  private readonly layoutsBySize = new Map<number, Set<number>[]>();

  add(symmetryKey: string, size: number, cells: readonly number[]): void {
    this.keys.add(symmetryKey);
    const layouts = this.layoutsBySize.get(size) ?? [];
    layouts.push(new Set(cells));
    this.layoutsBySize.set(size, layouts);
  }

  addEntry(entry: BridgesProblemPoolEntry): void {
    const { problem } = toBridgesPooledProblem(entry);
    this.add(
      getBridgesSymmetryKey(problem),
      problem.width,
      problem.islands.map(({ row, column }) => row * problem.width + column),
    );
  }

  isNear(size: number, cells: readonly number[]): boolean {
    const variants = listLayoutVariants(size, cells);
    return (this.layoutsBySize.get(size) ?? []).some((taken) =>
      variants.some((variant) => {
        let difference = 0;
        for (const cell of variant) {
          if (!taken.has(cell)) {
            difference += 1;
          }
        }
        for (const cell of taken) {
          if (!variant.has(cell)) {
            difference += 1;
          }
        }
        return (
          difference <=
          getNearLayoutDifference(Math.min(cells.length, taken.size))
        );
      }),
    );
  }
}

/**
 * 1つのレベルを選んでいる途中の状態。`turn` は次に1問を探す生成条件の番号。止まっても同じ順で続けられるよう、
 * 生成条件ごとの次の候補番号と、数えた量をすべて持つ。
 */
type LevelProgress = {
  entries: BridgesProblemPoolEntry[];
  candidateCount: number;
  outcomes: [string, number][];
  milliseconds: number[];
  nextIndex: number[];
  turn: number;
  flowCounts: [string, number][];
  openingCounts: [string, number][];
  openingShapeCounts: [string, number][];
  fingerprintCounts: [string, number][];
  tagCounts: [BridgesProblemTag, number][];
  round: number;
  misses: number[];
  resumeRounds: number[];
};

/**
 * 1つのレベルの問題を採る。生成条件を巡回し、各条件で次に当たる候補（候補番号の順）を1問ずつ採る。1つの条件で
 * `MAXIMUM_TRIES_PER_TURN` 候補を調べても採れなければ、続けて採れなかった回数に応じて何巡かその条件を飛ばす。回転・反転で同じ形の問題と、
 * 島の配置が近い問題は、別のレベルで採ったものも含めて除く。同じ流れ・同じ始まり・同じ指紋の問題の数と、札の割合
 * （`tagShareRules`）を守る。候補の調べは子プロセスに分けて先に走らせ、採る順は1プロセスで調べたときと同じにする。
 * `progressPath` があれば、1つの条件を調べ終えるたびに途中の状態を書き、あれば読んで続ける。
 */
async function selectLevel(
  difficulty: BridgesDifficulty,
  perLevel: number,
  budget: number,
  jobCount: number,
  taken: TakenProblems,
  progressPath: string | undefined,
): Promise<LevelSelection> {
  const rules: readonly TagShareRule[] = tagShareRules[difficulty];
  const flowLimit = getFlowLimit(perLevel);
  const openingLimit = getOpeningLimit(perLevel);
  const openingShapeLimit = getOpeningShapeLimit(perLevel);
  const conditions = listBridgesGenerationConditions(difficulty);
  const saved =
    progressPath !== undefined && existsSync(progressPath)
      ? (JSON.parse(readFileSync(progressPath, "utf8")) as LevelProgress)
      : null;
  if (saved !== null) {
    for (const entry of saved.entries) {
      taken.addEntry(entry);
    }
    console.log(
      `${progressPath} から L${difficulty} の途中（${saved.entries.length} 問）を読んだ`,
    );
  }
  const flowCounts = new Map(saved?.flowCounts ?? []);
  const openingCounts = new Map(saved?.openingCounts ?? []);
  const openingShapeCounts = new Map(saved?.openingShapeCounts ?? []);
  const fingerprintCounts = new Map(saved?.fingerprintCounts ?? []);
  const tagCounts = new Map(saved?.tagCounts ?? []);
  const nextIndex = saved?.nextIndex ?? conditions.map(() => 0);
  const evaluatedUntil = [...nextIndex];
  const buffers = conditions.map((): Candidate[] => []);
  const exhausted = nextIndex.map((index) => index >= budget);
  const selection: LevelSelection = {
    entries: saved?.entries ?? [],
    candidateCount: saved?.candidateCount ?? 0,
    outcomes: new Map(saved?.outcomes ?? []),
    milliseconds: saved?.milliseconds ?? [],
  };
  let turn = saved?.turn ?? 0;
  let round = saved?.round ?? 0;
  const misses = saved?.misses ?? conditions.map(() => 0);
  const resumeRounds = saved?.resumeRounds ?? conditions.map(() => 0);
  function saveProgress(): void {
    if (progressPath === undefined) {
      return;
    }
    const progress: LevelProgress = {
      ...selection,
      outcomes: [...selection.outcomes],
      nextIndex,
      turn,
      flowCounts: [...flowCounts],
      openingCounts: [...openingCounts],
      openingShapeCounts: [...openingShapeCounts],
      fingerprintCounts: [...fingerprintCounts],
      tagCounts: [...tagCounts],
      round,
      misses,
      resumeRounds,
    };
    writeFileSync(`${progressPath}.tmp`, JSON.stringify(progress));
    renameSync(`${progressPath}.tmp`, progressPath);
  }
  async function fillBuffers(drained: number): Promise<void> {
    const jobs = conditions.flatMap((condition, conditionIndex) => {
      const batchSize = getLookaheadBatchSize(condition);
      if (
        exhausted[conditionIndex] ||
        buffers[conditionIndex]!.length >= batchSize
      ) {
        return [];
      }
      const start = evaluatedUntil[conditionIndex]!;
      const count = Math.min(
        conditionIndex === drained
          ? getDrainedBatchPerJob(condition) * jobCount
          : batchSize,
        budget - start,
      );
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
  function accepts(candidate: Candidate): boolean {
    return (
      candidate.difficulty === difficulty &&
      candidate.entry !== null &&
      !taken.keys.has(candidate.symmetryKey) &&
      (flowCounts.get(candidate.flow) ?? 0) < flowLimit &&
      (openingCounts.get(candidate.opening) ?? 0) < openingLimit &&
      (openingShapeCounts.get(candidate.openingShape) ?? 0) <
        openingShapeLimit &&
      (fingerprintCounts.get(candidate.fingerprint) ?? 0) < FINGERPRINT_LIMIT &&
      fitsTagShares(
        rules,
        tagCounts,
        selection.entries.length,
        perLevel,
        candidate.tags,
      ) &&
      !taken.isNear(candidate.entry[0], candidate.cells) &&
      fitsWorkload(difficulty, candidate.entry)
    );
  }
  function take(candidate: Candidate): void {
    taken.add(candidate.symmetryKey, candidate.entry![0], candidate.cells);
    for (const [counts, key] of [
      [flowCounts, candidate.flow],
      [openingCounts, candidate.opening],
      [openingShapeCounts, candidate.openingShape],
      [fingerprintCounts, candidate.fingerprint],
    ] as const) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const tag of candidate.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    selection.entries.push(candidate.entry!);
    console.log(
      `L${difficulty}: ${selection.entries.length}/${perLevel}（候補 ${selection.candidateCount}・札 ${[
        ...tagCounts,
      ]
        .map(([tag, count]) => `${tag} ${count}`)
        .join(" ")}）`,
    );
  }
  while (selection.entries.length < perLevel) {
    if (exhausted.every(Boolean)) {
      throw new Error(
        `Level ${difficulty} ran out of candidates at ${selection.entries.length} problems (${countTagShortage(rules, tagCounts, perLevel).join(", ")})`,
      );
    }
    for (; turn < conditions.length; turn += 1) {
      const conditionIndex = turn;
      if (selection.entries.length >= perLevel) {
        break;
      }
      if (
        exhausted[conditionIndex] ||
        round < resumeRounds[conditionIndex]! ||
        isConditionCapped(
          rules,
          tagCounts,
          perLevel,
          conditions[conditionIndex]!,
        )
      ) {
        continue;
      }
      let accepted = false;
      let tries = 0;
      for (; tries < MAXIMUM_TRIES_PER_TURN; tries += 1) {
        if (nextIndex[conditionIndex]! >= budget) {
          exhausted[conditionIndex] = true;
          break;
        }
        if (buffers[conditionIndex]!.length === 0) {
          await fillBuffers(conditionIndex);
        }
        const candidate = buffers[conditionIndex]!.shift()!;
        nextIndex[conditionIndex]! += 1;
        selection.candidateCount += 1;
        selection.milliseconds.push(candidate.milliseconds);
        selection.outcomes.set(
          candidate.outcome,
          (selection.outcomes.get(candidate.outcome) ?? 0) + 1,
        );
        if (accepts(candidate)) {
          take(candidate);
          accepted = true;
          break;
        }
      }
      misses[conditionIndex] = accepted ? 0 : misses[conditionIndex]! + 1;
      resumeRounds[conditionIndex] = accepted
        ? round + 1 + Math.floor(tries / TRIES_PER_SKIPPED_TURN)
        : round + 2 ** misses[conditionIndex]!;
      saveProgress();
    }
    if (turn >= conditions.length) {
      turn = 0;
      round += 1;
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
  taken: TakenProblems,
): LevelSelection {
  const cached = JSON.parse(readFileSync(path, "utf8")) as Omit<
    LevelSelection,
    "outcomes"
  > & { outcomes: [string, number][] };
  for (const entry of cached.entries) {
    taken.addEntry(entry);
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
  const taken = new TakenProblems();
  const levels = {} as Record<BridgesDifficulty, BridgesProblemPoolEntry[]>;
  const selections: { id: BridgesDifficulty; selection: LevelSelection }[] = [];
  for (const { id } of difficultyLevels) {
    const cachePath =
      cacheDirectory === undefined
        ? undefined
        : `${cacheDirectory}/level-${id}-${perLevel}.json`;
    const selection =
      cachePath !== undefined && existsSync(cachePath)
        ? readCachedSelection(cachePath, taken)
        : await selectLevel(
            id,
            perLevel,
            budget,
            jobCount,
            taken,
            cachePath === undefined ? undefined : `${cachePath}.progress`,
          );
    if (cachePath !== undefined) {
      writeCachedSelection(cachePath, selection);
      rmSync(`${cachePath}.progress`, { force: true });
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
  const near = new TakenProblems();
  let seedDuplicateCount = 0;
  let fingerprintExcessCount = 0;
  let tagShareViolationCount = 0;
  let workloadViolationCount = 0;
  for (const { id } of difficultyLevels) {
    const entries = listBridgesPoolEntries(id);
    const flowCounts = new Map<string, number>();
    const openingCounts = new Map<string, number>();
    const openingShapeCounts = new Map<string, number>();
    const fingerprintCounts = new Map<string, number>();
    for (const entry of entries) {
      const { problem } = toBridgesPooledProblem(entry);
      const flow = describeBridgesSolveFlow(problem);
      flowCounts.set(flow, (flowCounts.get(flow) ?? 0) + 1);
      const opening = describeOpening(flow);
      openingCounts.set(opening, (openingCounts.get(opening) ?? 0) + 1);
      const fingerprint = describeBridgesSolveFingerprint(problem);
      const openingShape = describeOpening(fingerprint);
      openingShapeCounts.set(
        openingShape,
        (openingShapeCounts.get(openingShape) ?? 0) + 1,
      );
      fingerprintCounts.set(
        fingerprint,
        (fingerprintCounts.get(fingerprint) ?? 0) + 1,
      );
    }
    const flowLimit = getFlowLimit(entries.length);
    const openingLimit = getOpeningLimit(entries.length);
    const openingShapeLimit = getOpeningShapeLimit(entries.length);
    fingerprintExcessCount +=
      [...openingShapeCounts.values()].filter(
        (count) => count > openingShapeLimit,
      ).length +
      [...flowCounts.values()].filter((count) => count > flowLimit).length +
      [...openingCounts.values()].filter((count) => count > openingLimit)
        .length +
      [...fingerprintCounts.values()].filter(
        (count) => count > FINGERPRINT_LIMIT,
      ).length;
    console.log(
      `L${id}: 解く手順の流れ ${flowCounts.size} 種類（最多 ${Math.max(...flowCounts.values())} 問、上限 ${flowLimit} 問）・始まり ${openingCounts.size} 種類（最多 ${Math.max(...openingCounts.values())} 問、上限 ${openingLimit} 問）・始まりの形 ${openingShapeCounts.size} 種類（最多 ${Math.max(...openingShapeCounts.values())} 問、上限 ${openingShapeLimit} 問）・指紋 ${fingerprintCounts.size} 種類（最多 ${Math.max(...fingerprintCounts.values())} 問、上限 ${FINGERPRINT_LIMIT} 問）`,
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
      if (!fitsWorkload(id, entry)) {
        workloadViolationCount += 1;
      }
      const pooled = toBridgesPooledProblem(entry);
      const key = getBridgesSymmetryKey(pooled.problem);
      if (keys.has(key)) {
        duplicateCount += 1;
      }
      keys.set(key, `L${id}#${index}`);
      const layoutKey = getBridgesLayoutKey(pooled.problem);
      const cells = pooled.problem.islands.map(
        ({ row, column }) => row * pooled.problem.width + column,
      );
      if (layouts.has(layoutKey) || near.isNear(pooled.problem.width, cells)) {
        layoutDuplicateCount += 1;
      }
      layouts.add(layoutKey);
      near.add(key, pooled.problem.width, cells);
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
    `同型の重複 ${duplicateCount}・島の配置の重複と近い配置 ${layoutDuplicateCount}・seed の重複 ${seedDuplicateCount}・流れと始まりと指紋の上限超え ${fingerprintExcessCount}・札の割合の外れ ${tagShareViolationCount}・作業の量の境の外れ ${workloadViolationCount}`,
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
    tagShareViolationCount > 0 ||
    workloadViolationCount > 0
  ) {
    for (const failure of failures.slice(0, 20)) {
      console.error(
        `L${failure.difficulty}#${failure.index}: ${failure.reason}`,
      );
    }
    throw new Error(
      `Bridges problem pool verification failed: ${failures.length} entries, ${duplicateCount} symmetric duplicates, ${layoutDuplicateCount} layout duplicates, ${seedDuplicateCount} seed duplicates, ${fingerprintExcessCount} flows or fingerprints over the limit, ${tagShareViolationCount} tag share violations, ${workloadViolationCount} workload boundary violations`,
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
