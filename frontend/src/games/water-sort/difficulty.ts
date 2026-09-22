import type { WaterSortDifficultyAnalysis } from "@/games/water-sort/problem/difficulty-analysis";

export const waterSortDifficulties = [
  {
    id: "easy",
    label: "かんたん",
  },
  {
    id: "normal",
    label: "ふつう",
  },
  {
    id: "hard",
    label: "むずかしい",
  },
] as const;

export type WaterSortDifficulty = (typeof waterSortDifficulties)[number]["id"];

export type WaterSortDifficultyAssessment = {
  difficulty: WaterSortDifficulty;
};

const easyMaximumPreparationMoves = 2;
const easyMaximumEmptyBottlePressure = 0.65;
const hardMinimumPreparationMoves = 3;
const hardMinimumEmptyBottlePressure = 0.75;
const hardMinimumDeadEndChoiceRatio = 0.125;
const hardMinimumRiskyChoiceRatio = 0.75;
const hardMinimumDetourMoves = 2;

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

export function assessWaterSortDifficulty(
  analysis: WaterSortDifficultyAnalysis,
): WaterSortDifficultyAssessment {
  const risk = analysis.representativeChoiceRisk;
  const hasResolvedChoiceRisk = risk.unresolvedChoiceCount === 0;
  const riskyChoiceRatio = risk.detourChoiceRatio + risk.deadEndChoiceRatio;

  const isEasy =
    hasResolvedChoiceRisk &&
    analysis.preparationMoveCount <= easyMaximumPreparationMoves &&
    analysis.averageEmptyBottlePressure <= easyMaximumEmptyBottlePressure &&
    risk.deadEndChoiceRatio === 0 &&
    risk.maximumDetourMoves <= 1;
  if (isEasy) {
    return { difficulty: "easy" };
  }

  const hasMeaningfulWrongChoicePenalty =
    risk.deadEndChoiceRatio >= hardMinimumDeadEndChoiceRatio ||
    risk.maximumDetourMoves >= hardMinimumDetourMoves ||
    riskyChoiceRatio >= hardMinimumRiskyChoiceRatio;
  const isHard =
    hasResolvedChoiceRisk &&
    analysis.preparationMoveCount >= hardMinimumPreparationMoves &&
    analysis.averageEmptyBottlePressure >= hardMinimumEmptyBottlePressure &&
    hasMeaningfulWrongChoicePenalty;
  if (isHard) {
    return { difficulty: "hard" };
  }

  return { difficulty: "normal" };
}
