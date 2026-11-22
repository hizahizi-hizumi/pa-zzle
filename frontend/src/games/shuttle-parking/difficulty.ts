import {
  type DifficultyAssessment,
  type DifficultyLevel,
  isInNumericRange,
  type NumericRange,
} from "@/games/difficulty";
import type { ShuttleParkingDifficultyAnalysis } from "@/games/shuttle-parking/problem/difficulty-analysis";
import {
  SHUTTLE_PARKING_NAIVE_RULES,
  type ShuttleParkingNaiveRule,
} from "@/games/shuttle-parking/problem/generation/naive-rules";
import type { ShuttleParkingWeightBounds } from "@/games/shuttle-parking/problem/generation/readers";

export type ShuttleParkingDifficulty = DifficultyLevel;

/** 判定の決まり（レベルの段・範囲外の条件）が変わったら上げる。記録と診断に写す。 */
export const SHUTTLE_PARKING_DIFFICULTY_MODEL_VERSION = "1";

/**
 * レベルごとの、どの勝ち筋でも出会う最も重い罠の重さ（罠の結果が何人先に出るか）。
 * Lv1 は先頭に合わせて出せば罠に出会わない。Lv2 は罠の結果が4人先まで。Lv3 は5〜7人先、Lv4 は8〜9人先、Lv5 は10人以上先。
 */
export const SHUTTLE_PARKING_WEIGHT_BY_LEVEL = {
  "1": { minimum: 0, maximum: 0 },
  "2": { minimum: 1, maximum: 4 },
  "3": { minimum: 5, maximum: 7 },
  "4": { minimum: 8, maximum: 9 },
  "5": { minimum: 10, maximum: Number.POSITIVE_INFINITY },
} as const satisfies Record<ShuttleParkingDifficulty, NumericRange>;

/** 素朴な規則のどれかがこの勝率以上で勝てる問題は、Lv3 以上に置かない。 */
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
 * - `naiveCeiling`: Lv3 以上で、素朴な規則のどれかで勝率 0.8 以上。
 * - `headPoliciesAllLose`: Lv2 で、素朴な規則がどれも必ず負ける。
 */
export type ShuttleParkingOutOfRangeReason =
  | "bayCountOutOfRange"
  | "pathDependent"
  | "depthDefinitionsDisagree"
  | "playStylesDisagree"
  | "freePathEscapes"
  | "naiveCeiling"
  | "headPoliciesAllLose";

export type ShuttleParkingDifficultyAssessment = DifficultyAssessment<{
  classified: object;
  outOfRange: { reason: ShuttleParkingOutOfRangeReason };
  unsupported: { minimumBayCount: number | null };
  invalid: never;
}>;

/**
 * 判定の決まりの組。規則8つで進め方を広げた確かめをしない組は調査コードの判定と同じで、移植の確かめに使う。
 */
export type ShuttleParkingClassificationRules = {
  rules: readonly ShuttleParkingNaiveRule[];
  checksFreePath: boolean;
};

export const SHUTTLE_PARKING_CLASSIFICATION_RULES = {
  rules: Object.keys(SHUTTLE_PARKING_NAIVE_RULES) as ShuttleParkingNaiveRule[],
  checksFreePath: true,
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
    checksFreePath,
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
  const bestRule = Math.max(...rules.map((rule) => features.rules[rule]));
  if (upper && bestRule >= SHUTTLE_PARKING_NAIVE_CEILING) {
    return { status: "out-of-range", reason: "naiveCeiling" };
  }
  if (level === "2" && bestRule === 0) {
    return { status: "out-of-range", reason: "headPoliciesAllLose" };
  }
  return { status: "classified", difficulty: level };
}
