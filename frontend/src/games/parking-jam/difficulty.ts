import type { ParkingJamDifficultyAnalysis } from "@/games/parking-jam/problem/difficulty-analysis";

export const parkingJamDifficulties = [
  { id: "easy", label: "かんたん" },
  { id: "normal", label: "ふつう" },
  { id: "hard", label: "むずかしい" },
] as const;

export type ParkingJamDifficulty =
  (typeof parkingJamDifficulties)[number]["id"];

export const PARKING_JAM_DIFFICULTY_MODEL_VERSION = "visual-local-load-v1";

const difficultyFactorRanges = {
  initialBlockedVehicleCount: { minimum: 2, maximum: 5 },
  initialAverageMinimumBlockingVehicleCount: { minimum: 1, maximum: 1.5 },
  averageExitPathLength: { minimum: 1.5, maximum: 2.5 },
} as const;

const difficultyScoreThresholds = {
  easyMaximumScore: 1 / 3,
  hardMinimumScore: 2 / 3,
} as const;

export type ParkingJamDifficultyFactors = {
  initialBlockedVehicleCount: number;
  initialAverageMinimumBlockingVehicleCount: number;
  averageExitPathLength: number;
};

export type ParkingJamDifficultyAssessment = {
  modelVersion: typeof PARKING_JAM_DIFFICULTY_MODEL_VERSION;
  difficulty: ParkingJamDifficulty;
  score: number;
  factors: ParkingJamDifficultyFactors;
};

export function parseParkingJamDifficulty(
  value: string | undefined,
): ParkingJamDifficulty | undefined {
  return parkingJamDifficulties.find((difficulty) => difficulty.id === value)
    ?.id;
}

export function getParkingJamDifficultyLabel(
  difficulty: ParkingJamDifficulty,
): string {
  return (
    parkingJamDifficulties.find((option) => option.id === difficulty)?.label ??
    difficulty
  );
}

function normalizeDifficultyFactor(
  value: number,
  range: { minimum: number; maximum: number },
): number {
  const normalized = (value - range.minimum) / (range.maximum - range.minimum);
  return Math.min(1, Math.max(0, normalized));
}

export function calculateParkingJamDifficultyFactors(
  analysis: ParkingJamDifficultyAnalysis,
): ParkingJamDifficultyFactors {
  const { features } = analysis;
  return {
    initialBlockedVehicleCount:
      features.vehicleCount - features.initialLegalVehicleCount,
    initialAverageMinimumBlockingVehicleCount:
      features.initialAverageMinimumBlockingVehicleCount,
    averageExitPathLength: features.averageExitPathLength,
  };
}

function classifyDifficultyScore(score: number): ParkingJamDifficulty {
  if (score <= difficultyScoreThresholds.easyMaximumScore) return "easy";
  if (score >= difficultyScoreThresholds.hardMinimumScore) return "hard";
  return "normal";
}

export function assessParkingJamDifficulty(
  analysis: ParkingJamDifficultyAnalysis,
): ParkingJamDifficultyAssessment {
  const factors = calculateParkingJamDifficultyFactors(analysis);
  const score =
    (normalizeDifficultyFactor(
      factors.initialBlockedVehicleCount,
      difficultyFactorRanges.initialBlockedVehicleCount,
    ) +
      normalizeDifficultyFactor(
        factors.initialAverageMinimumBlockingVehicleCount,
        difficultyFactorRanges.initialAverageMinimumBlockingVehicleCount,
      ) +
      normalizeDifficultyFactor(
        factors.averageExitPathLength,
        difficultyFactorRanges.averageExitPathLength,
      )) /
    3;

  return {
    modelVersion: PARKING_JAM_DIFFICULTY_MODEL_VERSION,
    difficulty: classifyDifficultyScore(score),
    score,
    factors,
  };
}
