import {
  type DifficultyAssessment,
  type DifficultyLevel,
  difficultyLevels,
  isInNumericRange,
  type NoAssessmentDetail,
  type NumericRange,
  type RecordedDifficulty,
} from "@/games/difficulty";
import type { WaterSortGenerationConditions } from "@/games/water-sort/problem/problem";

export type WaterSortDifficulty = DifficultyLevel;

// 3段階の時代の記録を、旧区分のまま読み込み表示するためだけに残す。
export type WaterSortRecordedDifficulty = RecordedDifficulty;

type WaterSortGenerationProfile = Pick<
  WaterSortGenerationConditions,
  "colorCount" | "emptyBottleCount"
>;

type WaterSortDifficultyCriteria = {
  generationProfiles: readonly WaterSortGenerationProfile[];
  /** 下限ちょうどの詰み率は下のレベルに属する。 */
  stuckRate: NumericRange;
};

function createProfiles(
  minimumColorCount: number,
  maximumColorCount: number,
  emptyBottleCount: number,
): WaterSortGenerationProfile[] {
  return Array.from(
    { length: maximumColorCount - minimumColorCount + 1 },
    (_, index) => ({
      colorCount: minimumColorCount + index,
      emptyBottleCount,
    }),
  );
}

export const waterSortDifficultyCriteria = {
  "1": {
    generationProfiles: createProfiles(4, 6, 2),
    stuckRate: { minimum: Number.NEGATIVE_INFINITY, maximum: 0.05 },
  },
  "2": {
    generationProfiles: createProfiles(5, 8, 2),
    stuckRate: { minimum: 0.05, maximum: 0.35, excludesMinimum: true },
  },
  "3": {
    generationProfiles: [
      ...createProfiles(6, 9, 2),
      ...createProfiles(4, 5, 1),
    ],
    stuckRate: { minimum: 0.35, maximum: 0.7, excludesMinimum: true },
  },
  "4": {
    generationProfiles: [
      ...createProfiles(8, 11, 2),
      ...createProfiles(4, 6, 1),
    ],
    stuckRate: { minimum: 0.7, maximum: 0.9, excludesMinimum: true },
  },
  "5": {
    generationProfiles: [
      ...createProfiles(10, 12, 2),
      ...createProfiles(5, 7, 1),
    ],
    stuckRate: {
      minimum: 0.9,
      maximum: Number.POSITIVE_INFINITY,
      excludesMinimum: true,
    },
  },
} as const satisfies Record<WaterSortDifficulty, WaterSortDifficultyCriteria>;

function hasGenerationProfile(
  criteria: WaterSortDifficultyCriteria,
  conditions: WaterSortGenerationProfile,
): boolean {
  return criteria.generationProfiles.some(
    (profile) =>
      profile.colorCount === conditions.colorCount &&
      profile.emptyBottleCount === conditions.emptyBottleCount,
  );
}

/**
 * 問題を難易度へ分類した結果。
 * - `classified`: 生成条件と自然詰み率の組がいずれかのレベルに当たった。
 * - `out-of-range`: 生成条件と自然詰み率の組がどのレベルにも当たらないので提供しない。
 */
export type WaterSortDifficultyAssessment = DifficultyAssessment<{
  classified: NoAssessmentDetail;
  outOfRange: { reason: "unlisted-combination" };
  unsupported: never;
  invalid: never;
}>;

export function assessWaterSortDifficulty({
  conditions,
  stuckRate,
}: {
  conditions: WaterSortGenerationProfile;
  stuckRate: number;
}): WaterSortDifficultyAssessment {
  const difficulty = difficultyLevels.find(({ id }) => {
    const criteria = waterSortDifficultyCriteria[id];
    return (
      hasGenerationProfile(criteria, conditions) &&
      isInNumericRange(stuckRate, criteria.stuckRate)
    );
  })?.id;
  return difficulty
    ? { status: "classified", difficulty }
    : { status: "out-of-range", reason: "unlisted-combination" };
}
