import type { ParkingJamDifficultyFeatures } from "@/games/parking-jam/problem/difficulty-analysis";

export type ParkingJamLegacyLeverStrength = 1 | 2 | 3;

export type ParkingJamLegacyChallengeLevers = {
  dependency: ParkingJamLegacyLeverStrength;
  misread: ParkingJamLegacyLeverStrength;
  scale: ParkingJamLegacyLeverStrength;
};

const DEPENDENCY_DEEP_DEPTH = 4;
const DEPENDENCY_BRANCHED_DEPTH = 3;
const DEPENDENCY_MINIMUM_BRANCHING = 2;
const DEPENDENCY_MINIMUM_OVERLAP_PREREQUISITE_COUNT = 2;
const MISREAD_STRONG_MINIMUM_RATIO = 1 / 2;
const MISREAD_MODERATE_MINIMUM_RATIO = 1 / 4;
const SCALE_SMALL_MAXIMUM_CELL_COUNT = 36;
const SCALE_MEDIUM_MAXIMUM_CELL_COUNT = 48;
const SCALE_FEW_MAXIMUM_ELEMENT_COUNT = 8;
const SCALE_MODERATE_MAXIMUM_ELEMENT_COUNT = 11;

function classifyDependency(
  dependencyDepth: number,
  maximumPrerequisiteVehicleCount: number,
): ParkingJamLegacyLeverStrength {
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

function classifyMisread(
  misreadInducingVehicleCount: number,
  vehicleCount: number,
): ParkingJamLegacyLeverStrength {
  const ratio =
    vehicleCount === 0 ? 0 : misreadInducingVehicleCount / vehicleCount;
  if (ratio >= MISREAD_STRONG_MINIMUM_RATIO) return 3;
  if (ratio >= MISREAD_MODERATE_MINIMUM_RATIO) return 2;
  return 1;
}

function classifyScale(
  boardCellCount: number,
  vehicleCount: number,
  fixedAreaCount: number,
): ParkingJamLegacyLeverStrength {
  const areaStrength: ParkingJamLegacyLeverStrength =
    boardCellCount <= SCALE_SMALL_MAXIMUM_CELL_COUNT
      ? 1
      : boardCellCount <= SCALE_MEDIUM_MAXIMUM_CELL_COUNT
        ? 2
        : 3;
  const elementCount = vehicleCount + fixedAreaCount;
  const elementStrength: ParkingJamLegacyLeverStrength =
    elementCount <= SCALE_FEW_MAXIMUM_ELEMENT_COUNT
      ? 1
      : elementCount <= SCALE_MODERATE_MAXIMUM_ELEMENT_COUNT
        ? 2
        : 3;
  return Math.min(
    areaStrength,
    elementStrength,
  ) as ParkingJamLegacyLeverStrength;
}

export function calculateParkingJamChallengeLeversV1(
  features: ParkingJamDifficultyFeatures,
): ParkingJamLegacyChallengeLevers | null {
  if (features.maximumPrerequisiteVehicleCount === null) return null;
  return {
    dependency: classifyDependency(
      features.dependencyDepth,
      features.maximumPrerequisiteVehicleCount,
    ),
    misread: classifyMisread(
      features.misreadInducingVehicleCount,
      features.vehicleCount,
    ),
    scale: classifyScale(
      features.boardCellCount,
      features.vehicleCount,
      features.fixedAreaCount,
    ),
  };
}
