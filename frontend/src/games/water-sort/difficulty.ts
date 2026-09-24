import type { WaterSortGenerationConditions } from "@/games/water-sort/problem/problem";

export const waterSortDifficulties = [
  {
    id: "1",
    label: "レベル 1",
    description: "同じ色をまとめていけば解けます",
  },
  {
    id: "2",
    label: "レベル 2",
    description: "何も考えずに進めると、ときどき詰みます",
  },
  {
    id: "3",
    label: "レベル 3",
    description: "空きボトルの使い方を考えないと詰みます",
  },
  {
    id: "4",
    label: "レベル 4",
    description: "何度か先を読む必要があります",
  },
  {
    id: "5",
    label: "レベル 5",
    description: "先を読まずに進めると、ほぼ確実に詰みます",
  },
] as const;

export type WaterSortDifficulty = (typeof waterSortDifficulties)[number]["id"];

const legacyWaterSortDifficulties = [
  { id: "easy", label: "かんたん" },
  { id: "normal", label: "ふつう" },
  { id: "hard", label: "むずかしい" },
] as const;

export type LegacyWaterSortDifficulty =
  (typeof legacyWaterSortDifficulties)[number]["id"];

export type WaterSortRecordedDifficulty =
  | WaterSortDifficulty
  | LegacyWaterSortDifficulty;

export function parseWaterSortDifficulty(
  value: string | undefined,
): WaterSortDifficulty | undefined {
  return waterSortDifficulties.find((difficulty) => difficulty.id === value)
    ?.id;
}

export function parseWaterSortRecordedDifficulty(
  value: string | undefined,
): WaterSortRecordedDifficulty | undefined {
  return (
    parseWaterSortDifficulty(value) ??
    legacyWaterSortDifficulties.find((difficulty) => difficulty.id === value)
      ?.id
  );
}

export function getWaterSortDifficultyLabel(
  difficulty: WaterSortRecordedDifficulty,
): string {
  return (
    [...waterSortDifficulties, ...legacyWaterSortDifficulties].find(
      (option) => option.id === difficulty,
    )?.label ?? difficulty
  );
}

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
    waterSortDifficulties.find(({ id }) => {
      const criteria = waterSortDifficultyCriteria[id];
      return (
        hasGenerationProfile(criteria, conditions) &&
        isWithinStuckRate(criteria, stuckRate)
      );
    })?.id ?? null
  );
}
