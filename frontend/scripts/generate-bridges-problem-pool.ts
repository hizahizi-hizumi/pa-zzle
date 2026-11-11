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
  bridgesLevelCombinations,
  bridgesLevelReadings,
  bridgesLevelStructures,
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
import {
  BridgesGenerationExhaustedError,
  generateBridgesProblem,
} from "@/games/bridges/problem/generator";
import {
  BRIDGES_GENERATOR_VERSION,
  type BridgesBoardSize,
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
 * 島40以上の盤面で下限を超える。
 */
const NEAR_LAYOUT_SHARE = 0.1;

/**
 * 近いとみなす位置の違う島の数の下限。島を2つ動かしただけの配置を別の問題にしない。2島違いまでにすると、L1（島10前後）の
 * 60問で4島しか違わない組が30組並び、同じ盤面に見えた。
 */
const MINIMUM_NEAR_LAYOUT_DIFFERENCE = 4;

function getNearLayoutDifference(islandCount: number): number {
  return Math.max(
    MINIMUM_NEAR_LAYOUT_DIFFERENCE,
    Math.floor(islandCount * NEAR_LAYOUT_SHARE),
  );
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
 * - `count-reading`: 「少なくとも1本」の配分の読みが要る。
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
  | "point-symmetric"
  | "count-reading";

type TagShareRule = {
  tag: BridgesProblemTag;
  minimum?: number;
  maximum?: number;
};

/** L3〜L5 で、点対称の配置の問題の割合の上限。対称の盤面は見た目の見せ場だが、多いと同じ形に見える。 */
const POINT_SYMMETRIC_MAXIMUM_SHARE = 0.2;

/**
 * L4 と L5 を分ける、問題を解き切る作業の量（速さ満点の基準時間）の境。L4 はこれ以下、L5 はこれより長い問題だけを採る。
 * 先読みの場所の数で分けても、島の数・橋・読みの手詰まりの多い L4 は、作業の量が L5 の少ない問題を上回る。上のレベルの
 * 作業の量が下のレベルを必ず上回るよう、境で分ける。
 */
const LOOKAHEAD_LEVEL_WORKLOAD_BOUNDARY_MS = 500_000;

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

/**
 * 札の割合の決まり。上限は、問題の質の点（`scoreCandidate`）で上がりすぎる札を抑える。下限は、点だけでは届かない L1 の配分の
 * 読みに置き、下限の数までは点の高い順にその札の問題を先に採る。L1 の輪は、近い配置を2島違いまで除くと、当たった候補
 * 8,259 から輪のある問題を 91 問までしか採れないので、下限を置かず点で上げる。
 */
const tagShareRules = {
  "1": [
    { tag: "corner-opening", maximum: 0.5 },
    { tag: "count-reading", minimum: 0.4 },
  ],
  "2": [{ tag: "corner-opening", maximum: 0.3 }],
  "3": [
    { tag: "corner-opening", maximum: 0.3 },
    { tag: "point-symmetric", maximum: POINT_SYMMETRIC_MAXIMUM_SHARE },
  ],
  "4": [
    { tag: "corner-opening", maximum: 0.3 },
    { tag: "point-symmetric", maximum: POINT_SYMMETRIC_MAXIMUM_SHARE },
  ],
  "5": [
    { tag: "corner-opening", maximum: 0.3 },
    { tag: "point-symmetric", maximum: POINT_SYMMETRIC_MAXIMUM_SHARE },
  ],
} as const satisfies Record<BridgesDifficulty, readonly TagShareRule[]>;

/**
 * 唯一の通り道が要る候補に足す点。通り道は当たった候補の1割前後にしか出ず、ほかの手筋の点と同じ重さでは L5 で 3% まで
 * 減ったので、ほかの手筋より重くする。
 */
const PASSAGE_SCORE = 5;

/**
 * 先読みの山場が解き進みの後ろにある候補に足す点。先読みの場所の最も少ない解き順で最後の先読みが、行き先の
 * `LATE_LOOKAHEAD_DECIDED_RATIO` 以上が決まった後にあるか、1手の先読みの結果からすぐ次の先読みが要るなら足す。
 * L5 に当たった候補の半分ほどにしか無いので、下限にはせず、ほかの手筋より重い点で先に採る。
 */
const LATE_LOOKAHEAD_SCORE = 6;
const LATE_LOOKAHEAD_DECIDED_RATIO = 0.7;

/** 素朴な解き方（数字の読みと試し置き）で戻した回数の中央値1回ごとに足す点と、点にする回数の上限。 */
const BACKTRACK_SCORE = 1;
const BACKTRACK_SCORE_LIMIT = 4;

/**
 * 盤面の枠をなぞる形を引く点。解の橋が通る外周の線の割合のうち `BORDER_COVERAGE_ALLOWANCE` を超えた分に
 * `BORDER_COVERAGE_PENALTY` を掛けて引き、四隅の島が2つを超えた1つごとに `EXTRA_CORNER_PENALTY` を引く。
 */
const BORDER_COVERAGE_ALLOWANCE = 0.6;
const BORDER_COVERAGE_PENALTY = 15;
const EXTRA_CORNER_PENALTY = 1.5;

/**
 * 隣のレベルと共有する盤面の大きさのうち、問題数のこの割合以上を採る大きさ。共有する大きさが名ばかりにならないよう、下の
 * レベルと共有する小さい方の大きさに下限を置く。L4 の 9×9 に置く。L3 の 8×8 は、島17以上だと島の半分以上が外周に並び
 * （外周の島 5割以下を満たさない）、調べた候補 19,592 のどれも L3 に当たらず、L2 の 7×7 は島13以上だと配置がほとんど
 * 無い（当たった候補 57 から、近い配置を除くと3問）ので置かない。L1 の 7×7・L2 の 8×8 は既に大半。
 */
const MINIMUM_SHARED_SIZE_SHARE = 0.25;
const sharedSizesWithMinimum = {
  "1": [],
  "2": [],
  "3": [],
  "4": [9],
  "5": [],
} as const satisfies Record<BridgesDifficulty, readonly BridgesBoardSize[]>;

/** レベルの盤面の大きさごとの、採る問題の数の下限（`sharedSizesWithMinimum`）。 */
function listSizeQuotas(
  difficulty: BridgesDifficulty,
  perLevel: number,
): [size: number, quota: number][] {
  return sharedSizesWithMinimum[difficulty].map((size) => [
    size,
    Math.ceil(MINIMUM_SHARED_SIZE_SHARE * perLevel),
  ]);
}

/**
 * 同じレベルに当たった候補を並べる、問題の質の点。下限を満たしただけの候補より、次の候補を先に採る。
 * - 読みの余裕: そのレベルが求める読み（配分・つながり・閉じない読み・先読みと場所）が下限を超えた分。
 * - 手筋の種類: 唯一の通り道、3島以上の組、先読みで手を退けた理由の種類、孤立を見る先読み、交差で塞がる行き先。
 * - 山場の遅さ: 最後のつながりの読みと最初の先読みの前に、本数が決まっていた行き先の割合。先読みが解き進みの後ろで要るか、
 *   続けて要る候補は大きく上げる（`LATE_LOOKAHEAD_SCORE`）。
 * - 戻しの多さ: 素朴な解き方で戻した回数。
 * - 盤面の美しさ: 数字の平均、7・8 の島、長い橋、輪、点対称は足し、間が1マスの橋・外周の島・斜め隣の島・格子にそろう配置・
 *   外周の線をなぞる橋・3つ以上の四隅の島は引く。
 * L1 は読みを求めないので、配分の読みが1回あることと盤面の美しさで並べる。L5 は閉じない読みの一か所の気づきが2回以上の
 * 候補を上げ、L4 より組の読みの少ない問題を後に回す。
 */
function scoreCandidate(
  difficulty: BridgesDifficulty,
  {
    reasoning,
    scale,
    trial,
  }: Extract<BridgesDifficultyAnalysis, { requiresTrial: false }>,
): number {
  const surplus = (amount: number, minimum: number, cap: number) =>
    Math.min(cap, Math.max(0, amount - minimum));
  const combination = bridgesLevelCombinations[difficulty];
  const reading = bridgesLevelReadings[difficulty];
  const structure = bridgesLevelStructures[difficulty];
  const lookaheadLevel = reasoning.lookaheadRoundCount > 0;
  const margin =
    0.5 *
      surplus(
        reasoning.countRoundCount,
        combination.countRoundCount.minimum,
        2,
      ) +
    (difficulty === "1"
      ? 0
      : surplus(
          reasoning.connectivityRoundCount,
          combination.connectivityRoundCount.minimum,
          3,
        )) +
    surplus(reasoning.closureRoundCount, reading.closureRoundCount.minimum, 2) +
    2 *
      surplus(
        reasoning.lookaheadRoundCount,
        reading.lookaheadRoundCount.minimum,
        2,
      ) +
    2 *
      surplus(
        reasoning.lookaheadSpotCount,
        structure.lookaheadSpotCount.minimum,
        1,
      );
  const climax =
    lookaheadLevel &&
    (reasoning.lastLookaheadDecidedRatio >= LATE_LOOKAHEAD_DECIDED_RATIO ||
      reasoning.chainedLookaheadRoundCount > 0)
      ? LATE_LOOKAHEAD_SCORE
      : 0;
  const variety =
    (reasoning.passageRoundCount > 0 ? PASSAGE_SCORE : 0) +
    (reasoning.groupClosureRoundCount > 0 ? 0.5 : 0) +
    (reasoning.isolatingLookaheadRoundCount > 0 ? 1 : 0) +
    reasoning.lookaheadReasonKindCount +
    0.3 * Math.min(4, reasoning.crossingBlockCount);
  const lateness =
    (reasoning.connectivityRoundCount > 0
      ? 3 * reasoning.lastConnectivityDecidedRatio
      : 0) + (lookaheadLevel ? 3 * reasoning.firstLookaheadDecidedRatio : 0);
  const beauty =
    3 * (scale.clueMean - 2.8) +
    (scale.maximumClue >= 7 ? 1 : 0) +
    (scale.maximumClue === 8 ? 1.5 : 0) +
    0.5 * Math.min(4, scale.longBridgeCount) +
    0.5 * Math.min(3, scale.loopCount) +
    (scale.pointSymmetric === 1 ? 1.5 : 0) -
    6 * scale.shortBridgeShare -
    3 * scale.borderIslandShare -
    4 * scale.diagonalNeighborShare -
    4 * Math.max(0, scale.gridAlignmentShare - 0.3) -
    BORDER_COVERAGE_PENALTY *
      Math.max(0, scale.borderCoverageShare - BORDER_COVERAGE_ALLOWANCE) -
    EXTRA_CORNER_PENALTY * Math.max(0, scale.cornerIslandCount - 2);
  const entry = difficulty === "1" && reasoning.countRoundCount > 0 ? 2 : 0;
  const groupReading =
    difficulty === "5" && reasoning.closureRoundCount >= 2 ? 3 : 0;
  const backtrack =
    BACKTRACK_SCORE *
    Math.min(BACKTRACK_SCORE_LIMIT, trial.medianBacktrackCount);
  return (
    margin +
    variety +
    climax +
    lateness +
    beauty +
    entry +
    groupReading +
    backtrack
  );
}

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
    ...(reasoning.countRoundCount > 0 ? (["count-reading"] as const) : []),
  ];
}

/** 生成条件から必ず付く札。点対称の生成条件の候補は、どれも島の配置が点対称になる。 */
function listConditionTags(
  conditions: BridgesGenerationConditions,
): BridgesProblemTag[] {
  return conditions.layoutSymmetry === "point" ? ["point-symmetric"] : [];
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

const usage = `Usage: bun run generate:bridges-pool -- [options]

レベルごとに、レベルの盤面の範囲に入る全生成条件（盤面の一辺 × 島の数 × 2本の割合 × 輪の割合 × 分割の割合 ×
レベルに当たりやすい磨く回数と向き × L3〜L5 は点対称の配置）で、決定的な seed の候補を番号順に生成・分析・分類し、
そのレベルに当たった候補を採る数の数倍集める。集めた候補を問題の質の点の高い順に並べ、回転・反転（8通り）の同型と、
島の配置が近い問題（位置の違う島が4つか島の数の1割まで）をレベルをまたいで除き、同じ解く手順の流れは問題数の 2%、
始まり（最初の3回の手詰まり）は 5%、始まりの形（最初の3回の指紋）は 2%、指紋は3問までにし、札の割合の上限と下限、
下のレベルと共有する盤面の大きさの下限（L4 の 9×9 を 25% 以上）、L4 と L5 の作業の量の境を守って採る。

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
  quality: number;
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
  let generated: ReturnType<typeof generateBridgesProblem>;
  try {
    generated = generateBridgesProblem(identity);
  } catch (error) {
    if (!(error instanceof BridgesGenerationExhaustedError)) {
      throw error;
    }
    return {
      conditions,
      candidateIndex,
      milliseconds: performance.now() - started,
      outcome: GENERATION_EXHAUSTED_OUTCOME,
      difficulty: null,
      entry: null,
      symmetryKey: "",
      layoutKey: "",
      flow: "",
      opening: "",
      openingShape: "",
      fingerprint: "",
      cells: [],
      tags: [],
      quality: 0,
    };
  }
  const { problem, symmetryKey } = generated;
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
    quality: classified ? scoreCandidate(assessment.difficulty, analysis) : 0,
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
 * 採る数に対して、レベルに当たった候補を集める数の倍率。集めた候補を質の点の高い順に並べて採るので、下限を満たしただけの
 * 候補で埋まらない。札の上限や重複で外れる分を見込んで、足りなければ集め足す。
 */
const GATHER_FACTOR = 2;

/** 作り直す回数の上限までに盤面を作れなかった候補の結果。 */
const GENERATION_EXHAUSTED_OUTCOME = "generation-exhausted";

/**
 * 盤面を作れない候補が多い生成条件を調べるのをやめる、作れなかった候補の数の下限と、調べた候補に対する割合。島の数の多い
 * 条件は盤面の形の上限に収まる広げ方がまれで、1候補ごとに作り直す回数の上限まで試して時間を使う。
 */
const EXHAUSTED_CONDITION_MINIMUM = 4;
const EXHAUSTED_CONDITION_SHARE = 0.5;

/**
 * 集めた候補のうち、それまでに集めた候補と島の配置が近くない候補（新しい配置）の割合がこれを下回った生成条件は、調べるのを
 * やめる。小さな盤面の条件は、早く同じ配置ばかりになり、集めても採れる問題が増えない。判断は、その条件で当たった候補が
 * `STALE_CONDITION_MINIMUM_HITS` 以上集まってからにする。
 */
const STALE_CONDITION_NOVEL_SHARE = 0.1;
const STALE_CONDITION_MINIMUM_HITS = 20;

/**
 * 当たりが少ない生成条件を調べるのをやめる、調べた候補の数の下限と、レベル全体の当たりの割合に対する比。L3 の 8×8 のように、
 * 磨いても求める読みに届かない条件は、ほかの条件の何倍もの候補を使う。ただし、盤面の大きさごとの下限（`listSizeQuotas`）の
 * `GATHER_FACTOR` 倍に、その大きさの当たった候補が届かないうちは、その大きさの条件は新しい配置の割合と当たりの少なさでは
 * やめない。
 */
const LOW_YIELD_MINIMUM_CANDIDATES = 60;
const LOW_YIELD_RELATIVE_RATE = 0.25;

/** 足りなかったときに集め足す数の、採る数に対する割合。 */
const GATHER_STEP = 0.5;

/**
 * 1巡で生成条件ごとに調べる候補の数。磨く回数の少ない条件は1候補が軽いので多く調べ、子プロセスの起動の時間を調べる時間より
 * 小さくする。
 */
function getRoundBatchSize({
  refinementSteps,
}: BridgesGenerationConditions): number {
  if (refinementSteps <= 150) {
    return 32;
  }
  return refinementSteps <= 500 ? 12 : 4;
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

  clone(): TakenProblems {
    const copy = new TakenProblems();
    for (const key of this.keys) {
      copy.keys.add(key);
    }
    for (const [size, layouts] of this.layoutsBySize) {
      copy.layoutsBySize.set(size, [...layouts]);
    }
    return copy;
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
 * 1つのレベルの候補を集めている途中の状態。止まっても同じ順で続けられるよう、生成条件ごとの次の候補番号と、集めた候補と、
 * 数えた量をすべて持つ。
 */
type LevelProgress = {
  hits: Candidate[];
  candidateCount: number;
  outcomes: [string, number][];
  milliseconds: number[];
  nextIndex: number[];
  exhaustedCounts: number[];
  target: number;
};

/**
 * 集めた候補を質の点の高い順に並べ、重複と流れ・始まり・指紋の上限、札の上限、作業の量の境を守って採る。下限のある札は、
 * 下限の数までその札の候補を点の高い順に先に採り、盤面の大きさごとの下限（`listSizeQuotas`）も同じく先に採ってから、残りを
 * 点の高い順に採る。採る数か下限に届かなければ `null`。
 */
function rankAndSelect(
  difficulty: BridgesDifficulty,
  perLevel: number,
  hits: readonly Candidate[],
  taken: TakenProblems,
): Candidate[] | null {
  const rules: readonly TagShareRule[] = tagShareRules[difficulty];
  const limits = [
    [getFlowLimit(perLevel), (candidate: Candidate) => candidate.flow],
    [getOpeningLimit(perLevel), (candidate: Candidate) => candidate.opening],
    [
      getOpeningShapeLimit(perLevel),
      (candidate: Candidate) => candidate.openingShape,
    ],
    [FINGERPRINT_LIMIT, (candidate: Candidate) => candidate.fingerprint],
  ] as const;
  const counts = limits.map(() => new Map<string, number>());
  const tagCounts = new Map<BridgesProblemTag, number>();
  const chosen = taken.clone();
  const picked: Candidate[] = [];
  const pickedKeys = new Set<string>();
  const ranked = [...hits].sort(
    (left, right) =>
      right.quality - left.quality ||
      conditionKeyOf(left.conditions).localeCompare(
        conditionKeyOf(right.conditions),
      ) ||
      left.candidateIndex - right.candidateIndex,
  );
  function canTake(candidate: Candidate): boolean {
    return (
      !pickedKeys.has(
        `${conditionKeyOf(candidate.conditions)}#${candidate.candidateIndex}`,
      ) &&
      !chosen.keys.has(candidate.symmetryKey) &&
      limits.every(
        ([limit, keyOf], index) =>
          (counts[index]!.get(keyOf(candidate)) ?? 0) < limit,
      ) &&
      rules.every(
        ({ tag, maximum }) =>
          maximum === undefined ||
          !candidate.tags.includes(tag) ||
          (tagCounts.get(tag) ?? 0) < Math.floor(maximum * perLevel),
      ) &&
      fitsWorkload(difficulty, candidate.entry!) &&
      !chosen.isNear(candidate.entry![0], candidate.cells)
    );
  }
  function take(candidate: Candidate): void {
    chosen.add(candidate.symmetryKey, candidate.entry![0], candidate.cells);
    pickedKeys.add(
      `${conditionKeyOf(candidate.conditions)}#${candidate.candidateIndex}`,
    );
    for (const [index, [, keyOf]] of limits.entries()) {
      counts[index]!.set(
        keyOf(candidate),
        (counts[index]!.get(keyOf(candidate)) ?? 0) + 1,
      );
    }
    for (const tag of candidate.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    picked.push(candidate);
  }
  for (const { tag, minimum } of rules) {
    if (minimum === undefined) {
      continue;
    }
    const quota = Math.ceil(minimum * perLevel);
    for (const candidate of ranked) {
      if ((tagCounts.get(tag) ?? 0) >= quota || picked.length >= perLevel) {
        break;
      }
      if (candidate.tags.includes(tag) && canTake(candidate)) {
        take(candidate);
      }
    }
  }
  const countSize = (size: number) =>
    picked.filter((candidate) => candidate.entry![0] === size).length;
  const sizeQuotas = listSizeQuotas(difficulty, perLevel);
  for (const [size, quota] of sizeQuotas) {
    for (const candidate of ranked) {
      if (countSize(size) >= quota || picked.length >= perLevel) {
        break;
      }
      if (candidate.entry![0] === size && canTake(candidate)) {
        take(candidate);
      }
    }
  }
  for (const candidate of ranked) {
    if (picked.length >= perLevel) {
      break;
    }
    if (canTake(candidate)) {
      take(candidate);
    }
  }
  if (
    picked.length < perLevel ||
    countTagShortage(rules, tagCounts, perLevel).length > 0 ||
    sizeQuotas.some(([size, quota]) => countSize(size) < quota)
  ) {
    return null;
  }
  for (const candidate of picked) {
    taken.add(candidate.symmetryKey, candidate.entry![0], candidate.cells);
  }
  return picked;
}

/**
 * 1つのレベルの問題を採る。生成条件を巡回して各条件の候補を番号順に `getRoundBatchSize` ずつ調べ、そのレベルに当たった候補を、
 * 採る数の `GATHER_FACTOR` 倍まで集める。集めた候補を質の点の高い順に採り（`rankAndSelect`）、足りなければ集め足す。
 * 生成条件から必ず付く札（点対称）の候補は、その札の上限を採れる数の `GATHER_FACTOR` 倍まで集めたら、その条件を調べない。
 * 候補の調べは子プロセスに分け、集める順は1プロセスで調べたときと同じにする。`progressPath` があれば、1巡ごとに途中の状態を
 * 書き、あれば読んで続ける。
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
  const sizeQuotas = listSizeQuotas(difficulty, perLevel);
  const conditions = listBridgesGenerationConditions(difficulty);
  const saved =
    progressPath !== undefined && existsSync(progressPath)
      ? (JSON.parse(readFileSync(progressPath, "utf8")) as LevelProgress)
      : null;
  if (saved !== null) {
    console.log(
      `${progressPath} から L${difficulty} の途中（集めた候補 ${saved.hits.length}）を読んだ`,
    );
  }
  const hits = saved?.hits ?? [];
  const nextIndex = saved?.nextIndex ?? conditions.map(() => 0);
  const outcomes = new Map(saved?.outcomes ?? []);
  const milliseconds = saved?.milliseconds ?? [];
  let candidateCount = saved?.candidateCount ?? 0;
  const exhaustedCounts = saved?.exhaustedCounts ?? conditions.map(() => 0);
  const seen = taken.clone();
  const hitCounts = conditions.map(() => 0);
  const novelCounts = conditions.map(() => 0);
  const conditionIndexByKey = new Map(
    conditions.map((condition, index) => [conditionKeyOf(condition), index]),
  );
  function countNovelty(candidate: Candidate): void {
    const index = conditionIndexByKey.get(
      conditionKeyOf(candidate.conditions),
    )!;
    hitCounts[index]! += 1;
    if (
      !seen.keys.has(candidate.symmetryKey) &&
      !seen.isNear(candidate.entry![0], candidate.cells)
    ) {
      novelCounts[index]! += 1;
      seen.add(candidate.symmetryKey, candidate.entry![0], candidate.cells);
    }
  }
  for (const hit of hits) {
    countNovelty(hit);
  }
  let target = saved?.target ?? Math.ceil(GATHER_FACTOR * perLevel);
  function saveProgress(): void {
    if (progressPath === undefined) {
      return;
    }
    const progress: LevelProgress = {
      hits,
      candidateCount,
      outcomes: [...outcomes],
      milliseconds,
      nextIndex,
      exhaustedCounts,
      target,
    };
    writeFileSync(`${progressPath}.tmp`, JSON.stringify(progress));
    renameSync(`${progressPath}.tmp`, progressPath);
  }
  function isConditionGathered(condition: BridgesGenerationConditions) {
    return listConditionTags(condition).some((tag) =>
      rules.some(
        ({ tag: ruleTag, maximum }) =>
          ruleTag === tag &&
          maximum !== undefined &&
          hits.filter((hit) => hit.tags.includes(tag)).length >=
            GATHER_FACTOR * maximum * perLevel,
      ),
    );
  }
  for (;;) {
    while (hits.length < target) {
      const jobs = conditions.flatMap((condition, conditionIndex) => {
        const start = nextIndex[conditionIndex]!;
        const count = Math.min(getRoundBatchSize(condition), budget - start);
        const rarelyGenerated =
          exhaustedCounts[conditionIndex]! >= EXHAUSTED_CONDITION_MINIMUM &&
          exhaustedCounts[conditionIndex]! >
            EXHAUSTED_CONDITION_SHARE * nextIndex[conditionIndex]!;
        const stale =
          hitCounts[conditionIndex]! >= STALE_CONDITION_MINIMUM_HITS &&
          novelCounts[conditionIndex]! <
            STALE_CONDITION_NOVEL_SHARE * hitCounts[conditionIndex]!;
        const lowYield =
          nextIndex[conditionIndex]! >= LOW_YIELD_MINIMUM_CANDIDATES &&
          hitCounts[conditionIndex]! / nextIndex[conditionIndex]! <
            (LOW_YIELD_RELATIVE_RATE * hits.length) /
              Math.max(1, candidateCount);
        const sizeShort = sizeQuotas.some(
          ([size, quota]) =>
            size === condition.size &&
            hits.filter((hit) => hit.entry![0] === size).length <
              GATHER_FACTOR * quota,
        );
        return count > 0 &&
          !rarelyGenerated &&
          (sizeShort || (!stale && !lowYield)) &&
          !isConditionGathered(condition)
          ? [{ conditionIndex, conditions: condition, start, count }]
          : [];
      });
      if (jobs.length === 0) {
        throw new Error(
          `Level ${difficulty} ran out of candidates at ${hits.length} gathered candidates`,
        );
      }
      const results = await evaluateInParallel(jobs, jobCount);
      for (const job of jobs) {
        for (const candidate of results.get(job.conditionIndex) ?? []) {
          candidateCount += 1;
          milliseconds.push(candidate.milliseconds);
          outcomes.set(
            candidate.outcome,
            (outcomes.get(candidate.outcome) ?? 0) + 1,
          );
          if (candidate.difficulty === difficulty && candidate.entry !== null) {
            hits.push(candidate);
            countNovelty(candidate);
          }
          if (candidate.outcome === GENERATION_EXHAUSTED_OUTCOME) {
            exhaustedCounts[job.conditionIndex]! += 1;
          }
        }
        nextIndex[job.conditionIndex]! += job.count;
      }
      saveProgress();
      console.log(
        `L${difficulty}: 集めた候補 ${hits.length}/${target}（調べた候補 ${candidateCount}）`,
      );
    }
    const picked = rankAndSelect(difficulty, perLevel, hits, taken);
    if (picked !== null) {
      return {
        entries: picked.map(({ entry }) => entry!),
        candidateCount,
        outcomes,
        milliseconds,
      };
    }
    target += Math.ceil(GATHER_STEP * perLevel);
    console.log(`L${difficulty}: 採る数に届かないので ${target} まで集め足す`);
    saveProgress();
  }
}

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
