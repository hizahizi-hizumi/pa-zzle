import {
  type DifficultyLevel,
  difficultyLevels,
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
  minimumExclusiveStuckRate: number | null;
  maximumInclusiveStuckRate: number | null;
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

export const waterSortDifficultyCriteria: Record<
  WaterSortDifficulty,
  WaterSortDifficultyCriteria
> = {
  "1": {
    generationProfiles: createProfiles(4, 6, 2),
    minimumExclusiveStuckRate: null,
    maximumInclusiveStuckRate: 0.05,
  },
  "2": {
    generationProfiles: createProfiles(5, 8, 2),
    minimumExclusiveStuckRate: 0.05,
    maximumInclusiveStuckRate: 0.35,
  },
  "3": {
    generationProfiles: [
      ...createProfiles(6, 9, 2),
      ...createProfiles(4, 5, 1),
    ],
    minimumExclusiveStuckRate: 0.35,
    maximumInclusiveStuckRate: 0.7,
  },
  "4": {
    generationProfiles: [
      ...createProfiles(8, 11, 2),
      ...createProfiles(4, 6, 1),
    ],
    minimumExclusiveStuckRate: 0.7,
    maximumInclusiveStuckRate: 0.9,
  },
  "5": {
    generationProfiles: [
      ...createProfiles(10, 12, 2),
      ...createProfiles(5, 7, 1),
    ],
    minimumExclusiveStuckRate: 0.9,
    maximumInclusiveStuckRate: null,
  },
};

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

function isWithinStuckRate(
  criteria: WaterSortDifficultyCriteria,
  stuckRate: number,
): boolean {
  return (
    (criteria.minimumExclusiveStuckRate === null ||
      stuckRate > criteria.minimumExclusiveStuckRate) &&
    (criteria.maximumInclusiveStuckRate === null ||
      stuckRate <= criteria.maximumInclusiveStuckRate)
  );
}

export function assessWaterSortDifficulty({
  conditions,
  stuckRate,
}: {
  conditions: WaterSortGenerationProfile;
  stuckRate: number;
}): WaterSortDifficulty | null {
  return (
    difficultyLevels.find(({ id }) => {
      const criteria = waterSortDifficultyCriteria[id];
      return (
        hasGenerationProfile(criteria, conditions) &&
        isWithinStuckRate(criteria, stuckRate)
      );
    })?.id ?? null
  );
}
