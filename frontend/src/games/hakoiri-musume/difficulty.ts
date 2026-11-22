import {
  type DifficultyAssessment,
  type DifficultyLevel,
  difficultyLevels,
  isInNumericRange,
  type NoAssessmentDetail,
  type NumericRange,
} from "@/games/difficulty";
import type {
  HakoiriMusumeDifficultyAnalysis,
  HakoiriMusumeDifficultyFeatures,
} from "@/games/hakoiri-musume/problem/difficulty-analysis";

export type HakoiriMusumeDifficulty = DifficultyLevel;

/** 準備の長さの帯でレベルが1つに決まり、娘の遠回りと空きはそのレベルで許す範囲として確かめる。 */
export type HakoiriMusumeLevelCriteria = {
  preparationLength: NumericRange;
  daughterDetourCount: NumericRange;
  emptyCellCount: NumericRange;
  maximumShortestPreparationShare: number;
};

const unbounded = Number.POSITIVE_INFINITY;

/**
 * レベル2 以上で許す、最短の解の準備の長さの割合の上限。最短の解が1つの区間だけになる問題（準備 = 最短手数 − 1）を、
 * 提供する最短手数（8手以上）のすべてで外す（7/8 を下回る）値のうち、レベル5 を最も多く残す値。準備の長さが最短手数の 9 割以上の
 * 問題も外れる。
 */
const dividedPreparationShare = 0.87;

/**
 * レベル1 の準備の上限は易しい例（準備6・遠回り1）が入る値、レベル5 の下限は天井の横刀立馬（準備40・遠回り3以上・空き2）が
 * レベル5 の中ほどに来る値に置き、その間を準備の長さ7手ずつに分けた。
 */
export const hakoiriMusumeLevelCriteria = {
  "1": {
    preparationLength: { minimum: 0, maximum: 8 },
    daughterDetourCount: { minimum: 0, maximum: 1 },
    emptyCellCount: { minimum: 4, maximum: 6 },
    maximumShortestPreparationShare: 1,
  },
  "2": {
    preparationLength: { minimum: 9, maximum: 15 },
    daughterDetourCount: { minimum: 0, maximum: 1 },
    emptyCellCount: { minimum: 3, maximum: 6 },
    maximumShortestPreparationShare: dividedPreparationShare,
  },
  "3": {
    preparationLength: { minimum: 16, maximum: 22 },
    daughterDetourCount: { minimum: 1, maximum: 2 },
    emptyCellCount: { minimum: 2, maximum: 4 },
    maximumShortestPreparationShare: dividedPreparationShare,
  },
  "4": {
    preparationLength: { minimum: 23, maximum: 29 },
    daughterDetourCount: { minimum: 1, maximum: 2 },
    emptyCellCount: { minimum: 2, maximum: 3 },
    maximumShortestPreparationShare: dividedPreparationShare,
  },
  "5": {
    preparationLength: { minimum: 30, maximum: unbounded },
    daughterDetourCount: { minimum: 2, maximum: unbounded },
    emptyCellCount: { minimum: 2, maximum: 2 },
    maximumShortestPreparationShare: dividedPreparationShare,
  },
} as const satisfies Record<
  HakoiriMusumeDifficulty,
  HakoiriMusumeLevelCriteria
>;

/** 91手以上は天井の横刀立馬（81手）を大きく超える。 */
export const hakoiriMusumeOptimalMoveCountRange = {
  minimum: 8,
  maximum: 90,
} as const satisfies NumericRange;

/**
 * 分析結果を難易度へ分類した結果。
 * - `out-of-range`: 最短手数が短すぎる（`too-light`）・長すぎる（`too-long`）、または準備の長さで決まるレベルの遠回りか空きの
 *   範囲に入らないか、最短の解の準備の長さの割合がそのレベルの上限を超える（`unlisted-combination`）。
 * - `unsupported`: 盤のマスが 32 を超える盤（6 × 6）の問題。全局面を数え切れない。
 * - `invalid`: 娘を出口の前へ運べない。
 */
export type HakoiriMusumeDifficultyAssessment = DifficultyAssessment<{
  classified: NoAssessmentDetail;
  outOfRange: {
    reason: "too-light" | "too-long" | "unlisted-combination";
  };
  unsupported: { reason: "unsupported-board" };
  invalid: { reason: "unreachable-exit" };
}>;

type HakoiriMusumeClassifiedFeatures = Pick<
  HakoiriMusumeDifficultyFeatures,
  | "optimalMoveCount"
  | "preparationLength"
  | "daughterDetourCount"
  | "emptyCellCount"
  | "shortestPreparationLength"
>;

function findLevelByPreparation(
  preparationLength: number,
): HakoiriMusumeDifficulty | null {
  return (
    difficultyLevels.find(({ id }) =>
      isInNumericRange(
        preparationLength,
        hakoiriMusumeLevelCriteria[id].preparationLength,
      ),
    )?.id ?? null
  );
}

/** 特徴を難易度へ分類する。問題集の生成でも、全局面の特徴から1つずつ分類するのに使う。 */
export function classifyHakoiriMusumeFeatures(
  features: HakoiriMusumeClassifiedFeatures,
): HakoiriMusumeDifficultyAssessment {
  if (features.optimalMoveCount < hakoiriMusumeOptimalMoveCountRange.minimum) {
    return { status: "out-of-range", reason: "too-light" };
  }
  if (features.optimalMoveCount > hakoiriMusumeOptimalMoveCountRange.maximum) {
    return { status: "out-of-range", reason: "too-long" };
  }
  const difficulty = findLevelByPreparation(features.preparationLength);
  if (difficulty === null) {
    return { status: "out-of-range", reason: "unlisted-combination" };
  }
  const criteria = hakoiriMusumeLevelCriteria[difficulty];
  const fits =
    isInNumericRange(
      features.daughterDetourCount,
      criteria.daughterDetourCount,
    ) &&
    isInNumericRange(features.emptyCellCount, criteria.emptyCellCount) &&
    features.shortestPreparationLength <=
      criteria.maximumShortestPreparationShare * features.optimalMoveCount;
  return fits
    ? { status: "classified", difficulty }
    : { status: "out-of-range", reason: "unlisted-combination" };
}

export function assessHakoiriMusumeDifficulty(
  analysis: HakoiriMusumeDifficultyAnalysis,
): HakoiriMusumeDifficultyAssessment {
  switch (analysis.status) {
    case "invalid":
      return { status: "invalid", reason: analysis.reason };
    case "unsupported":
      return { status: "unsupported", reason: analysis.reason };
    case "analyzed":
      return classifyHakoiriMusumeFeatures(analysis.features);
  }
}
