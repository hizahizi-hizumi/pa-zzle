import type { ParkingJamDifficultyAnalysis } from "./problem/difficulty-analysis";

export const parkingJamDifficulties = [
  { id: "easy", label: "かんたん" },
  { id: "normal", label: "ふつう" },
  { id: "hard", label: "むずかしい" },
] as const;

export type ParkingJamDifficulty =
  (typeof parkingJamDifficulties)[number]["id"];

export const PARKING_JAM_DIFFICULTY_MODEL_VERSION = "dependency-v1";
export const PARKING_JAM_REVIEW_DIFFICULTY_MODEL_VERSION =
  "cognitive-load-review-v1";

export const PARKING_JAM_DIFFICULTY_THRESHOLDS = {
  easyMaximumDependencyDepth: 2,
  easyMinimumInitialLegalVehicleRatio: 0.75,
  easyMinimumSolutionOrderFreedom: 0.9,
  hardDeepMinimumDependencyDepth: 4,
  hardDeepMaximumSolutionOrderFreedom: 0.86,
  hardConstrainedMaximumInitialLegalVehicleRatio: 0.6,
  hardConstrainedMaximumSolutionOrderFreedom: 0.78,
} as const;

const reviewLoadRanges = {
  blockedVehicleRatio: { minimum: 0.1, maximum: 0.5 },
  vehicleCellOccupancyRatio: { minimum: 0.3, maximum: 0.6 },
  averageMinimumBlockingVehicleCount: { minimum: 1, maximum: 1.45 },
  averageExitPathLength: { minimum: 1, maximum: 2.8 },
  maximumVehicleBlockingDegree: { minimum: 1, maximum: 4 },
  forcedChoiceChainRatio: { minimum: 0.125, maximum: 0.375 },
} as const;

const reviewDifficultyThresholds = {
  hardMinimumScore: 0.52,
  hardMinimumHighLoadComponentCount: 2,
  hardMaximumForcedChoiceChainRatio: 0.25,
  easyMaximumScore: 0.3,
  easyMinimumLowLoadComponentCount: 2,
  highLoadComponentMinimum: 0.5,
  lowLoadComponentMaximum: 0.3,
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

export type ParkingJamReviewDifficultyLoads = {
  search: number;
  path: number;
  relation: number;
  forcedChoiceChainRatio: number;
  forcedChoicePenalty: number;
};

export type ParkingJamReviewDifficultyAssessment =
  | {
      status: "rated";
      modelVersion: typeof PARKING_JAM_REVIEW_DIFFICULTY_MODEL_VERSION;
      difficulty: ParkingJamDifficulty;
      score: number;
      loads: ParkingJamReviewDifficultyLoads;
    }
  | {
      status: "unsupported";
      modelVersion: typeof PARKING_JAM_REVIEW_DIFFICULTY_MODEL_VERSION;
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

function normalizeReviewLoad(
  value: number,
  range: { minimum: number; maximum: number },
): number {
  const normalized = (value - range.minimum) / (range.maximum - range.minimum);
  return Math.min(1, Math.max(0, normalized));
}

function calculateReviewDifficultyLoads(
  analysis: ParkingJamDifficultyAnalysis,
): ParkingJamReviewDifficultyLoads | null {
  const { features } = analysis;
  if (
    analysis.status === "unsupported" ||
    features.averageLegalVehicleRatio === null ||
    features.averageMinimumBlockingVehicleCount === null ||
    features.maximumForcedChoiceChainLength === null
  ) {
    return null;
  }

  const blockedVehicleRatio = 1 - features.averageLegalVehicleRatio;
  const search =
    (normalizeReviewLoad(
      blockedVehicleRatio,
      reviewLoadRanges.blockedVehicleRatio,
    ) +
      normalizeReviewLoad(
        features.vehicleCellOccupancyRatio,
        reviewLoadRanges.vehicleCellOccupancyRatio,
      )) /
    2;
  const path =
    (normalizeReviewLoad(
      features.averageMinimumBlockingVehicleCount,
      reviewLoadRanges.averageMinimumBlockingVehicleCount,
    ) +
      normalizeReviewLoad(
        features.averageExitPathLength,
        reviewLoadRanges.averageExitPathLength,
      )) /
    2;
  const relation =
    (normalizeReviewLoad(
      features.maximumVehicleBlockingInDegree,
      reviewLoadRanges.maximumVehicleBlockingDegree,
    ) +
      normalizeReviewLoad(
        features.maximumVehicleBlockingOutDegree,
        reviewLoadRanges.maximumVehicleBlockingDegree,
      )) /
    2;
  const forcedChoiceChainRatio =
    features.maximumForcedChoiceChainLength /
    Math.max(1, features.vehicleCount);
  const forcedChoicePenalty = normalizeReviewLoad(
    forcedChoiceChainRatio,
    reviewLoadRanges.forcedChoiceChainRatio,
  );

  return {
    search,
    path,
    relation,
    forcedChoiceChainRatio,
    forcedChoicePenalty,
  };
}

export function assessParkingJamReviewDifficulty(
  analysis: ParkingJamDifficultyAnalysis,
): ParkingJamReviewDifficultyAssessment {
  const loads = calculateReviewDifficultyLoads(analysis);
  if (!loads) {
    return {
      status: "unsupported",
      modelVersion: PARKING_JAM_REVIEW_DIFFICULTY_MODEL_VERSION,
    };
  }

  const score = Math.min(
    1,
    Math.max(
      0,
      loads.search * 0.35 +
        loads.path * 0.35 +
        loads.relation * 0.3 -
        loads.forcedChoicePenalty * 0.2,
    ),
  );
  const loadComponents = [loads.search, loads.path, loads.relation];
  const highLoadComponentCount = loadComponents.filter(
    (load) => load >= reviewDifficultyThresholds.highLoadComponentMinimum,
  ).length;
  const lowLoadComponentCount = loadComponents.filter(
    (load) => load <= reviewDifficultyThresholds.lowLoadComponentMaximum,
  ).length;

  const isHard =
    score >= reviewDifficultyThresholds.hardMinimumScore &&
    highLoadComponentCount >=
      reviewDifficultyThresholds.hardMinimumHighLoadComponentCount &&
    loads.forcedChoiceChainRatio <
      reviewDifficultyThresholds.hardMaximumForcedChoiceChainRatio;
  if (isHard) {
    return {
      status: "rated",
      modelVersion: PARKING_JAM_REVIEW_DIFFICULTY_MODEL_VERSION,
      difficulty: "hard",
      score,
      loads,
    };
  }

  const isEasy =
    score <= reviewDifficultyThresholds.easyMaximumScore &&
    lowLoadComponentCount >=
      reviewDifficultyThresholds.easyMinimumLowLoadComponentCount;
  if (isEasy) {
    return {
      status: "rated",
      modelVersion: PARKING_JAM_REVIEW_DIFFICULTY_MODEL_VERSION,
      difficulty: "easy",
      score,
      loads,
    };
  }

  return {
    status: "rated",
    modelVersion: PARKING_JAM_REVIEW_DIFFICULTY_MODEL_VERSION,
    difficulty: "normal",
    score,
    loads,
  };
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
