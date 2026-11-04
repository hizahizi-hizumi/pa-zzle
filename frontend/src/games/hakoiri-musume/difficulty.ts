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

/**
 * 1つのレベルの基準。準備の長さの帯でレベルが1つに決まり、娘の遠回りと空きはそのレベルで許す範囲として確かめる。
 * どちらの量も、どんな長さの解でもよく、値が最も小さくなる解で数える（娘を往復させるなど、手を足しても小さくならない）。
 * - `preparationLength`: 娘が出口へ新しく一歩近づくまでに要る手の数の最長。その間は盤面に進み具合が見えず、よける駒と順を
 *   頭の中でつなぐ読みが要る。
 * - `daughterDetourCount`: どう解いても避けられない、娘を出口から遠ざける手の数。見た目の進み具合に逆らう判断の回数。
 * - `emptyCellCount`: 空きマスの数。少ないほど、1つの駒を動かすために先に動かす駒の連鎖が長い。隣のレベルと重ね、規模だけで
 *   レベルが決まらないようにする。
 */
export type HakoiriMusumeLevelCriteria = {
  preparationLength: NumericRange;
  daughterDetourCount: NumericRange;
  emptyCellCount: NumericRange;
};

const unbounded = Number.POSITIVE_INFINITY;

/**
 * 各レベルの基準（暫定値。人の試遊で確かめる前）。上のレベルは、準備の長さ・遠回り・空きのどの系統でも下げない。
 * レベル1 の準備の上限は合意の易しい例（準備6）が入る値、レベル5 の下限は合意の天井の横刀立馬（準備30・遠回り2・空き2）が入る値に
 * 置き、その間を準備の長さ7手ずつに分けた。遠回りはレベル3 から1回以上、レベル5 で2回以上を求める。
 */
export const hakoiriMusumeLevelCriteria = {
  "1": {
    preparationLength: { minimum: 0, maximum: 8 },
    daughterDetourCount: { minimum: 0, maximum: 0 },
    emptyCellCount: { minimum: 4, maximum: 6 },
  },
  "2": {
    preparationLength: { minimum: 9, maximum: 15 },
    daughterDetourCount: { minimum: 0, maximum: 1 },
    emptyCellCount: { minimum: 3, maximum: 6 },
  },
  "3": {
    preparationLength: { minimum: 16, maximum: 22 },
    daughterDetourCount: { minimum: 1, maximum: 2 },
    emptyCellCount: { minimum: 2, maximum: 4 },
  },
  "4": {
    preparationLength: { minimum: 23, maximum: 29 },
    daughterDetourCount: { minimum: 1, maximum: 2 },
    emptyCellCount: { minimum: 2, maximum: 3 },
  },
  "5": {
    preparationLength: { minimum: 30, maximum: unbounded },
    daughterDetourCount: { minimum: 2, maximum: unbounded },
    emptyCellCount: { minimum: 2, maximum: 2 },
  },
} as const satisfies Record<
  HakoiriMusumeDifficulty,
  HakoiriMusumeLevelCriteria
>;

/**
 * 提供する最短手数の範囲。7手以下はよける順を読む前に解けるので出さない。91手以上は合意した天井（横刀立馬、81手）を超えるので
 * 出さない。最短手数は作業の量なので、この範囲のほかには分類に使わない。
 */
export const hakoiriMusumeOptimalMoveCountRange = {
  minimum: 8,
  maximum: 90,
} as const satisfies NumericRange;

/**
 * 分析結果を難易度へ分類した結果。
 * - `out-of-range`: 最短手数が短すぎる（`too-light`）・長すぎる（`too-long`）、または準備の長さで決まるレベルの遠回りか空きの
 *   範囲に入らない（`unlisted-combination`）。
 * - `unsupported`: 起こらない（全局面を数え切れる）。
 * - `invalid`: 娘を出口の前へ運べない。
 */
export type HakoiriMusumeDifficultyAssessment = DifficultyAssessment<{
  classified: NoAssessmentDetail;
  outOfRange: {
    reason: "too-light" | "too-long" | "unlisted-combination";
  };
  unsupported: never;
  invalid: { reason: "unreachable-exit" };
}>;

type HakoiriMusumeClassifiedFeatures = Pick<
  HakoiriMusumeDifficultyFeatures,
  | "optimalMoveCount"
  | "preparationLength"
  | "daughterDetourCount"
  | "emptyCellCount"
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
    ) && isInNumericRange(features.emptyCellCount, criteria.emptyCellCount);
  return fits
    ? { status: "classified", difficulty }
    : { status: "out-of-range", reason: "unlisted-combination" };
}

export function assessHakoiriMusumeDifficulty(
  analysis: HakoiriMusumeDifficultyAnalysis,
): HakoiriMusumeDifficultyAssessment {
  return analysis.status === "invalid"
    ? { status: "invalid", reason: analysis.reason }
    : classifyHakoiriMusumeFeatures(analysis.features);
}
