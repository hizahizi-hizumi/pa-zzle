import type { ParkingJamDifficultyAnalysis } from "./problem/difficulty-analysis";

export const parkingJamDifficulties = [
  { id: "easy", label: "かんたん" },
  { id: "normal", label: "ふつう" },
  { id: "hard", label: "むずかしい" },
] as const;

export type ParkingJamDifficulty =
  (typeof parkingJamDifficulties)[number]["id"];

export const PARKING_JAM_DIFFICULTY_MODEL_VERSION = "dependency-v1";

export const PARKING_JAM_DIFFICULTY_THRESHOLDS = {
  easyMaximumDependencyDepth: 2,
  easyMinimumInitialLegalVehicleRatio: 0.75,
  easyMinimumSolutionOrderFreedom: 0.9,
  hardDeepMinimumDependencyDepth: 4,
  hardDeepMaximumSolutionOrderFreedom: 0.86,
  hardConstrainedMaximumInitialLegalVehicleRatio: 0.6,
  hardConstrainedMaximumSolutionOrderFreedom: 0.78,
} as const;

export type ParkingJamDifficultyAssessment =
  | {
      status: "rated";
      modelVersion: typeof PARKING_JAM_DIFFICULTY_MODEL_VERSION;
      difficulty: ParkingJamDifficulty;
    }
  | {
      status: "unsupported";
      modelVersion: typeof PARKING_JAM_DIFFICULTY_MODEL_VERSION;
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

export function assessParkingJamDifficulty(
  analysis: ParkingJamDifficultyAnalysis,
): ParkingJamDifficultyAssessment {
  const { features } = analysis;
  if (
    analysis.status === "unsupported" ||
    features.solutionOrderFreedom === null
  ) {
    return {
      status: "unsupported",
      modelVersion: PARKING_JAM_DIFFICULTY_MODEL_VERSION,
    };
  }

  const isEasy =
    features.dependencyDepth <=
      PARKING_JAM_DIFFICULTY_THRESHOLDS.easyMaximumDependencyDepth &&
    features.initialLegalVehicleRatio >=
      PARKING_JAM_DIFFICULTY_THRESHOLDS.easyMinimumInitialLegalVehicleRatio &&
    features.solutionOrderFreedom >=
      PARKING_JAM_DIFFICULTY_THRESHOLDS.easyMinimumSolutionOrderFreedom;
  if (isEasy) {
    return {
      status: "rated",
      modelVersion: PARKING_JAM_DIFFICULTY_MODEL_VERSION,
      difficulty: "easy",
    };
  }

  const hasDeepDependencies =
    features.dependencyDepth >=
      PARKING_JAM_DIFFICULTY_THRESHOLDS.hardDeepMinimumDependencyDepth &&
    features.solutionOrderFreedom <=
      PARKING_JAM_DIFFICULTY_THRESHOLDS.hardDeepMaximumSolutionOrderFreedom;
  const hasConstrainedOrder =
    features.initialLegalVehicleRatio <=
      PARKING_JAM_DIFFICULTY_THRESHOLDS.hardConstrainedMaximumInitialLegalVehicleRatio &&
    features.solutionOrderFreedom <=
      PARKING_JAM_DIFFICULTY_THRESHOLDS.hardConstrainedMaximumSolutionOrderFreedom;
  if (hasDeepDependencies || hasConstrainedOrder) {
    return {
      status: "rated",
      modelVersion: PARKING_JAM_DIFFICULTY_MODEL_VERSION,
      difficulty: "hard",
    };
  }

  return {
    status: "rated",
    modelVersion: PARKING_JAM_DIFFICULTY_MODEL_VERSION,
    difficulty: "normal",
  };
}
