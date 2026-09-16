import type { WaterSortProblemFeatures } from "./solver";

export const waterSortDifficulties = [
  {
    id: "easy",
    label: "かんたん",
    description: "まずは操作とルールに慣れる難易度です。",
  },
  {
    id: "normal",
    label: "ふつう",
    description: "何手か先を考えながら進める難易度です。",
  },
  {
    id: "hard",
    label: "むずかしい",
    description: "手順を慎重に組み立てる難易度です。",
  },
] as const;

export type WaterSortDifficulty = (typeof waterSortDifficulties)[number]["id"];

export type WaterSortDifficultyAssessment = {
  difficulty: WaterSortDifficulty;
  index: number;
};

const averageDistinctChoiceWeight = 2;
const noEmptyBottleStateWeight = 4;
const forcedChoiceWeight = 2;
const normalDifficultyIndexThreshold = 24;
const hardDifficultyIndexThreshold = 32;

export function parseWaterSortDifficulty(
  value: string | undefined,
): WaterSortDifficulty | undefined {
  return waterSortDifficulties.find((difficulty) => difficulty.id === value)
    ?.id;
}

export function getWaterSortDifficultyLabel(
  difficulty: WaterSortDifficulty,
): string {
  return (
    waterSortDifficulties.find((option) => option.id === difficulty)?.label ??
    difficulty
  );
}

export function calculateWaterSortDifficultyIndex(
  features: WaterSortProblemFeatures,
): number {
  return (
    features.shortestMoveCount +
    features.averageDistinctChoiceCountOnSolution *
      averageDistinctChoiceWeight +
    features.noEmptyBottleStateRatio * noEmptyBottleStateWeight -
    features.forcedChoiceRatio * forcedChoiceWeight
  );
}

export function assessWaterSortDifficulty(
  features: WaterSortProblemFeatures,
): WaterSortDifficultyAssessment {
  const index = calculateWaterSortDifficultyIndex(features);

  if (index < normalDifficultyIndexThreshold) {
    return { difficulty: "easy", index };
  }
  if (index < hardDifficultyIndexThreshold) {
    return { difficulty: "normal", index };
  }
  return { difficulty: "hard", index };
}
