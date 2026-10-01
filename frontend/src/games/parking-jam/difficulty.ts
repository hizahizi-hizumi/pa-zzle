import type {
  ParkingJamDifficultyAnalysis,
  ParkingJamDifficultyFeatures,
} from "@/games/parking-jam/problem/difficulty-analysis";

export const parkingJamDifficulties = [
  { id: "1", label: "レベル 1" },
  { id: "2", label: "レベル 2" },
  { id: "3", label: "レベル 3" },
  { id: "4", label: "レベル 4" },
  { id: "5", label: "レベル 5" },
] as const;

export type ParkingJamDifficulty =
  (typeof parkingJamDifficulties)[number]["id"];

const legacyParkingJamDifficulties = [
  { id: "easy", label: "かんたん" },
  { id: "normal", label: "ふつう" },
  { id: "hard", label: "むずかしい" },
] as const;

export type LegacyParkingJamDifficulty =
  (typeof legacyParkingJamDifficulties)[number]["id"];

export type ParkingJamRecordedDifficulty =
  | ParkingJamDifficulty
  | LegacyParkingJamDifficulty;

export const PARKING_JAM_DIFFICULTY_MODEL_VERSION = "dependency-choice-v2";

export function parseParkingJamDifficulty(
  value: string | undefined,
): ParkingJamDifficulty | undefined {
  return parkingJamDifficulties.find((difficulty) => difficulty.id === value)
    ?.id;
}

export function parseLegacyParkingJamDifficulty(
  value: string | undefined,
): LegacyParkingJamDifficulty | undefined {
  return legacyParkingJamDifficulties.find(
    (difficulty) => difficulty.id === value,
  )?.id;
}

export function parseParkingJamRecordedDifficulty(
  value: string | undefined,
): ParkingJamRecordedDifficulty | undefined {
  return (
    parseParkingJamDifficulty(value) ?? parseLegacyParkingJamDifficulty(value)
  );
}

export function getParkingJamDifficultyLabel(
  difficulty: ParkingJamRecordedDifficulty,
): string {
  return (
    [...parkingJamDifficulties, ...legacyParkingJamDifficulties].find(
      (option) => option.id === difficulty,
    )?.label ?? difficulty
  );
}

export type ParkingJamDifficultyFactorStrength = 1 | 2 | 3;

export type ParkingJamDifficultyFactors = {
  /** 塞いでいる車を何段さかのぼり、何台の先行車を同時に扱う必要があるか。 */
  dependency: ParkingJamDifficultyFactorStrength;
  /** プレイ中に出せる車がどれだけ絞られ、出庫順がどれだけ制約されるか。 */
  choiceConstraint: ParkingJamDifficultyFactorStrength;
};

const MINIMUM_PROVIDED_DEPENDENCY_DEPTH = 2;
const MINIMUM_PROVIDED_INITIAL_BLOCKED_VEHICLE_COUNT = 2;
const MAXIMUM_PROVIDED_DEPENDENCY_DEPTH = 6;

const DEPENDENCY_DEEP_DEPTH = 4;
const DEPENDENCY_BRANCHED_DEPTH = 3;
const DEPENDENCY_MINIMUM_BRANCHING = 2;
const DEPENDENCY_MINIMUM_OVERLAP_PREREQUISITE_COUNT = 2;

const LOOSE_CHOICE_MINIMUM_AVERAGE_LEGAL_RATIO = 0.85;
const LOOSE_CHOICE_MINIMUM_ORDER_FREEDOM = 0.85;
const TIGHT_CHOICE_MAXIMUM_AVERAGE_LEGAL_RATIO = 0.7;
const TIGHT_CHOICE_MAXIMUM_ORDER_FREEDOM = 0.7;

function classifyDependency(
  dependencyDepth: number,
  maximumPrerequisiteVehicleCount: number,
): ParkingJamDifficultyFactorStrength {
  const branching = maximumPrerequisiteVehicleCount - (dependencyDepth - 1);
  if (
    dependencyDepth >= DEPENDENCY_DEEP_DEPTH ||
    (dependencyDepth === DEPENDENCY_BRANCHED_DEPTH &&
      branching >= DEPENDENCY_MINIMUM_BRANCHING)
  ) {
    return 3;
  }
  if (
    dependencyDepth === DEPENDENCY_BRANCHED_DEPTH ||
    maximumPrerequisiteVehicleCount >=
      DEPENDENCY_MINIMUM_OVERLAP_PREREQUISITE_COUNT
  ) {
    return 2;
  }
  return 1;
}

function classifyChoiceConstraint(
  averageLegalVehicleRatio: number,
  solutionOrderFreedom: number,
): ParkingJamDifficultyFactorStrength {
  if (
    averageLegalVehicleRatio >= LOOSE_CHOICE_MINIMUM_AVERAGE_LEGAL_RATIO &&
    solutionOrderFreedom >= LOOSE_CHOICE_MINIMUM_ORDER_FREEDOM
  ) {
    return 1;
  }
  if (
    averageLegalVehicleRatio < TIGHT_CHOICE_MAXIMUM_AVERAGE_LEGAL_RATIO &&
    solutionOrderFreedom < TIGHT_CHOICE_MAXIMUM_ORDER_FREEDOM
  ) {
    return 3;
  }
  return 2;
}

export function calculateParkingJamDifficultyFactors(
  features: ParkingJamDifficultyFeatures,
): ParkingJamDifficultyFactors | null {
  if (
    features.maximumPrerequisiteVehicleCount === null ||
    features.averageLegalVehicleRatio === null ||
    features.solutionOrderFreedom === null
  ) {
    return null;
  }
  return {
    dependency: classifyDependency(
      features.dependencyDepth,
      features.maximumPrerequisiteVehicleCount,
    ),
    choiceConstraint: classifyChoiceConstraint(
      features.averageLegalVehicleRatio,
      features.solutionOrderFreedom,
    ),
  };
}

function difficultyFromFactors({
  dependency,
  choiceConstraint,
}: ParkingJamDifficultyFactors): ParkingJamDifficulty {
  return String(dependency + choiceConstraint - 1) as ParkingJamDifficulty;
}

export type ParkingJamDifficultyAssessment =
  | {
      status: "classified";
      difficulty: ParkingJamDifficulty;
      factors: ParkingJamDifficultyFactors;
    }
  | { status: "out-of-range"; reason: "too-light" | "too-heavy" }
  | { status: "unsupported" };

export function assessParkingJamDifficulty(
  analysis: ParkingJamDifficultyAnalysis,
): ParkingJamDifficultyAssessment {
  const { features } = analysis;
  const factors = calculateParkingJamDifficultyFactors(features);
  if (analysis.status === "unsupported" || factors === null) {
    return { status: "unsupported" };
  }

  const initialBlockedVehicleCount =
    features.vehicleCount - features.initialLegalVehicleCount;
  if (
    features.dependencyDepth < MINIMUM_PROVIDED_DEPENDENCY_DEPTH ||
    initialBlockedVehicleCount < MINIMUM_PROVIDED_INITIAL_BLOCKED_VEHICLE_COUNT
  ) {
    return { status: "out-of-range", reason: "too-light" };
  }
  if (features.dependencyDepth > MAXIMUM_PROVIDED_DEPENDENCY_DEPTH) {
    return { status: "out-of-range", reason: "too-heavy" };
  }

  return {
    status: "classified",
    difficulty: difficultyFromFactors(factors),
    factors,
  };
}
