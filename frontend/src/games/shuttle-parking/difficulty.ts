import {
  type DifficultyAssessment,
  type DifficultyLevel,
  isInNumericRange,
  type NumericRange,
} from "@/games/difficulty";
import {
  type ShuttleParkingDifficultyAnalysis,
  SHUTTLE_PARKING_UPPER_LEVEL_MINIMUM_WEIGHTS as upperMinimum,
} from "@/games/shuttle-parking/problem/difficulty-analysis";
import {
  SHUTTLE_PARKING_NAIVE_RULES,
  type ShuttleParkingNaiveRule,
} from "@/games/shuttle-parking/problem/generation/naive-rules";
import type { ShuttleParkingWeightBounds } from "@/games/shuttle-parking/problem/generation/readers";

export type ShuttleParkingDifficulty = DifficultyLevel;

/** 判定の決まり（レベルの段・範囲外の条件）が変わったら上げる。記録と診断に写す。 */
export const SHUTTLE_PARKING_DIFFICULTY_MODEL_VERSION = "3";

/**
 * レベルごとの、どの勝ち筋でも出会う最も重い罠の重さ（罠の結果が何人先に出るか）。
 * Lv1 は先頭に合わせて出せば罠に出会わない。Lv2 は罠の結果が4人先まで。Lv3 は5〜7人先、Lv4 は8〜9人先、Lv5 は10人以上先。
 */
export const SHUTTLE_PARKING_WEIGHT_BY_LEVEL = {
  "1": { minimum: 0, maximum: 0 },
  "2": { minimum: 1, maximum: 4 },
  "3": { minimum: upperMinimum["3"], maximum: upperMinimum["4"] - 1 },
  "4": { minimum: upperMinimum["4"], maximum: upperMinimum["5"] - 1 },
  "5": { minimum: upperMinimum["5"], maximum: Number.POSITIVE_INFINITY },
} as const satisfies Record<ShuttleParkingDifficulty, NumericRange>;

/** 素朴な規則のどれか、または素朴な解き方の候補から下限より1人少なく読む人が、この勝率以上で勝てる問題は、Lv3 以上に置かない。 */
export const SHUTTLE_PARKING_NAIVE_CEILING = 0.8;

/** 待機枠の数の範囲。解ける最小の数がこの外の問題は出さない。 */
export const SHUTTLE_PARKING_BAY_COUNT_RANGE = {
  minimum: 2,
  maximum: 4,
} as const satisfies NumericRange;

/**
 * 範囲外のわけ（判定の順）。
 * - `bayCountOutOfRange`: 解ける最小の待機枠が範囲の外。
 * - `pathDependent`: 先頭に合わせる人の勝ち筋の選び方で、レベルが変わる。
 * - `depthDefinitionsDisagree`: 罠の深さの2つの取り方でレベルが変わる。
 * - `playStylesDisagree`: 先回りする人ではレベルが変わる（Lv1 で先回りする人が浅い罠に出会うのは許す）。
 * - `freePathEscapes`: Lv3 以上で、候補の外の勝つ手から進めると重い罠を避けて通れる。
 * - `naiveCeiling`: Lv3 以上で、素朴な規則のどれかが、同点のどれかの選び方で勝率 0.8 以上。
 * - `naiveReaderWins`: Lv3 以上で、素朴な解き方の候補から、そのレベルの重さの下限より1人少なく読む人が勝率 0.8 以上。
 * - `headPoliciesAllLose`: Lv2 で、素朴な規則がどれも、同点をどう選んでも必ず負ける。
 */
export type ShuttleParkingOutOfRangeReason =
  | "bayCountOutOfRange"
  | "pathDependent"
  | "depthDefinitionsDisagree"
  | "playStylesDisagree"
  | "freePathEscapes"
  | "naiveCeiling"
  | "naiveReaderWins"
  | "headPoliciesAllLose";

export type ShuttleParkingDifficultyAssessment = DifficultyAssessment<{
  classified: object;
  outOfRange: { reason: ShuttleParkingOutOfRangeReason };
  unsupported: { minimumBayCount: number | null };
  invalid: never;
}>;

/**
 * 判定の決まりの組。`tieBreaks` が `uniform` なら規則の勝率を同点を一様に選んだ値で、`best` なら同点の選び方ごとの最大で見る。
 * 規則8つ・一様・進め方を広げた確かめなし・読む人の確かめなしの組は調査コードの判定と同じで、移植の確かめに使う。
 */
export type ShuttleParkingClassificationRules = {
  rules: readonly ShuttleParkingNaiveRule[];
  tieBreaks: "uniform" | "best";
  checksFreePath: boolean;
  checksNaiveReader: boolean;
};

export const SHUTTLE_PARKING_CLASSIFICATION_RULES = {
  rules: Object.keys(SHUTTLE_PARKING_NAIVE_RULES) as ShuttleParkingNaiveRule[],
  tieBreaks: "best",
  checksFreePath: true,
  checksNaiveReader: true,
} as const satisfies ShuttleParkingClassificationRules;

export function getShuttleParkingWeightLevel(
  weight: number,
): ShuttleParkingDifficulty {
  const levels = Object.entries(SHUTTLE_PARKING_WEIGHT_BY_LEVEL) as [
    ShuttleParkingDifficulty,
    NumericRange,
  ][];
  return (
    levels.find(([, range]) => isInNumericRange(weight, range))?.[0] ?? "5"
  );
}

function isPathIndependent({ minimum, maximum }: ShuttleParkingWeightBounds) {
  return (
    getShuttleParkingWeightLevel(minimum) ===
    getShuttleParkingWeightLevel(maximum)
  );
}

export function assessShuttleParkingDifficulty(
  analysis: ShuttleParkingDifficultyAnalysis,
  {
    rules,
    tieBreaks,
    checksFreePath,
    checksNaiveReader,
  }: ShuttleParkingClassificationRules = SHUTTLE_PARKING_CLASSIFICATION_RULES,
): ShuttleParkingDifficultyAssessment {
  if (analysis.status === "unsupported") {
    return { status: "unsupported", minimumBayCount: analysis.minimumBayCount };
  }
  const { features } = analysis;
  if (!isInNumericRange(features.bayCount, SHUTTLE_PARKING_BAY_COUNT_RANGE)) {
    return { status: "out-of-range", reason: "bayCountOutOfRange" };
  }
  const { best, continuation } = features.headFirst;
  if (!isPathIndependent(best) || !isPathIndependent(continuation)) {
    return { status: "out-of-range", reason: "pathDependent" };
  }
  const level = getShuttleParkingWeightLevel(best.minimum);
  if (getShuttleParkingWeightLevel(continuation.minimum) !== level) {
    return { status: "out-of-range", reason: "depthDefinitionsDisagree" };
  }
  const windowLevel = getShuttleParkingWeightLevel(features.window.minimum);
  if (windowLevel !== level && !(level === "1" && windowLevel === "2")) {
    return { status: "out-of-range", reason: "playStylesDisagree" };
  }
  const upper = level !== "1" && level !== "2";
  if (
    checksFreePath &&
    upper &&
    getShuttleParkingWeightLevel(features.freePathMinimumWeight) !== level
  ) {
    return { status: "out-of-range", reason: "freePathEscapes" };
  }
  const winRates = tieBreaks === "best" ? features.bestRules : features.rules;
  const bestRule = Math.max(...rules.map((rule) => winRates[rule]));
  if (upper && bestRule >= SHUTTLE_PARKING_NAIVE_CEILING) {
    return { status: "out-of-range", reason: "naiveCeiling" };
  }
  if (
    checksNaiveReader &&
    upper &&
    features.naiveReader[level] >= SHUTTLE_PARKING_NAIVE_CEILING
  ) {
    return { status: "out-of-range", reason: "naiveReaderWins" };
  }
  if (level === "2" && bestRule === 0) {
    return { status: "out-of-range", reason: "headPoliciesAllLose" };
  }
  return { status: "classified", difficulty: level };
}
