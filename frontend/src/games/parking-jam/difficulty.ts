import type { ParkingJamDifficultyAnalysis } from "./problem/difficulty-analysis";

export const parkingJamDifficulties = [
  { id: "easy", label: "かんたん" },
  { id: "normal", label: "ふつう" },
  { id: "hard", label: "むずかしい" },
] as const;

export type ParkingJamDifficulty =
  (typeof parkingJamDifficulties)[number]["id"];

export const PARKING_JAM_DIFFICULTY_MODEL_VERSION = "structural-load-v2";

export const PARKING_JAM_DIFFICULTY_THRESHOLDS = {
  easyMaximumVehicleCount: 10,
  easyMaximumDependencyDepth: 2,
  easyMinimumAverageLegalVehicleRatio: 0.82,
  easyMaximumRequiredPrecedenceCount: 2,
  easyMaximumRequiredPredecessorCount: 1,
  easyMinimumSolutionOrderFreedom: 0.87,
  hardMinimumDependencyDepth: 3,
  hardMaximumAverageLegalVehicleRatio: 0.75,
  hardMaximumMinimumLegalVehicleRatio: 1 / 3,
  hardMinimumRequiredPrecedenceCount: 8,
  hardMinimumRequiredPredecessorCount: 3,
  hardMaximumSolutionOrderFreedom: 0.82,
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
    features.averageLegalVehicleRatio === null ||
    features.minimumLegalVehicleRatio === null ||
    features.requiredPrecedenceCount === null ||
    features.maximumRequiredPredecessorCount === null ||
    features.solutionOrderFreedom === null
  ) {
    return {
      status: "unsupported",
      modelVersion: PARKING_JAM_DIFFICULTY_MODEL_VERSION,
    };
  }

  const isEasy =
    features.vehicleCount <=
      PARKING_JAM_DIFFICULTY_THRESHOLDS.easyMaximumVehicleCount &&
    features.dependencyDepth <=
      PARKING_JAM_DIFFICULTY_THRESHOLDS.easyMaximumDependencyDepth &&
    features.averageLegalVehicleRatio >=
      PARKING_JAM_DIFFICULTY_THRESHOLDS.easyMinimumAverageLegalVehicleRatio &&
    features.requiredPrecedenceCount <=
      PARKING_JAM_DIFFICULTY_THRESHOLDS.easyMaximumRequiredPrecedenceCount &&
    features.maximumRequiredPredecessorCount <=
      PARKING_JAM_DIFFICULTY_THRESHOLDS.easyMaximumRequiredPredecessorCount &&
    features.solutionOrderFreedom >=
      PARKING_JAM_DIFFICULTY_THRESHOLDS.easyMinimumSolutionOrderFreedom;
  if (isEasy) {
    return {
      status: "rated",
      modelVersion: PARKING_JAM_DIFFICULTY_MODEL_VERSION,
      difficulty: "easy",
    };
  }

  const isHard =
    features.dependencyDepth >=
      PARKING_JAM_DIFFICULTY_THRESHOLDS.hardMinimumDependencyDepth &&
    features.averageLegalVehicleRatio <=
      PARKING_JAM_DIFFICULTY_THRESHOLDS.hardMaximumAverageLegalVehicleRatio &&
    features.minimumLegalVehicleRatio <=
      PARKING_JAM_DIFFICULTY_THRESHOLDS.hardMaximumMinimumLegalVehicleRatio &&
    features.requiredPrecedenceCount >=
      PARKING_JAM_DIFFICULTY_THRESHOLDS.hardMinimumRequiredPrecedenceCount &&
    features.maximumRequiredPredecessorCount >=
      PARKING_JAM_DIFFICULTY_THRESHOLDS.hardMinimumRequiredPredecessorCount &&
    features.solutionOrderFreedom <=
      PARKING_JAM_DIFFICULTY_THRESHOLDS.hardMaximumSolutionOrderFreedom;
  if (isHard) {
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
