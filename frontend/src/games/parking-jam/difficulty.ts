import {
  type DifficultyAssessment,
  type DifficultyLevel,
  difficultyLevels,
  isInNumericRange,
  type NoAssessmentDetail,
  type NumericRange,
  type RecordedDifficulty,
} from "@/games/difficulty";
import type {
  ParkingJamDifficultyAnalysis,
  ParkingJamDifficultyFeatures,
} from "@/games/parking-jam/problem/difficulty-analysis";

export type ParkingJamDifficulty = DifficultyLevel;

// 3段階（visual-local-load-v1）時代の記録を、旧区分のまま読み込み表示するためだけに残す。
export type ParkingJamRecordedDifficulty = RecordedDifficulty;

export const PARKING_JAM_DIFFICULTY_MODEL_VERSION = "challenge-levers-v1";

/** 挑戦を強めるレバーの強さ。1が最も弱い。 */
export type ParkingJamLeverStrength = 1 | 2 | 3;

/** 仕様の難易度の3つの観点（依存の深さ・広さ、読み違いの誘いやすさ、規模）の強さ。 */
export type ParkingJamChallengeLevers = {
  dependency: ParkingJamLeverStrength;
  misread: ParkingJamLeverStrength;
  scale: ParkingJamLeverStrength;
};

// 段数（`dependencyDepth`）は出せる車をまとめて出す層の数で、仕様の「さかのぼる段数」より1多い。
const MINIMUM_PROVIDED_DEPENDENCY_DEPTH = 2;
const MINIMUM_PROVIDED_INITIAL_BLOCKED_VEHICLE_COUNT = 2;
const MAXIMUM_PROVIDED_DEPENDENCY_DEPTH = 6;

// 境界はすべて人間校正前の暫定値。
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

/**
 * 1: 塞いでいる車はすぐ出せる（段数2で、2台以上を先に出す車がない）。
 * 2: 2台以上を先に出す車がある、または塞いでいる車がさらに塞がれている（段数3で枝分かれ1以下）。
 * 3: 3段以上さかのぼる（段数4以上）、または2段の待ちが枝分かれする（段数3で枝分かれ2以上）。
 */
function classifyDependencyLever(
  dependencyDepth: number,
  maximumPrerequisiteVehicleCount: number,
): ParkingJamLeverStrength {
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

/** 読み違いを誘う車が4台に1台未満なら1、2台に1台未満なら2、それ以上なら3。車が多いだけでは上がらない。 */
function classifyMisreadLever(
  misreadInducingVehicleCount: number,
  vehicleCount: number,
): ParkingJamLeverStrength {
  const ratio =
    vehicleCount === 0 ? 0 : misreadInducingVehicleCount / vehicleCount;
  if (ratio >= MISREAD_STRONG_MINIMUM_RATIO) return 3;
  if (ratio >= MISREAD_MODERATE_MINIMUM_RATIO) return 2;
  return 1;
}

function classifyScaleLever(
  boardCellCount: number,
  vehicleCount: number,
  fixedAreaCount: number,
): ParkingJamLeverStrength {
  const areaStrength: ParkingJamLeverStrength =
    boardCellCount <= SCALE_SMALL_MAXIMUM_CELL_COUNT
      ? 1
      : boardCellCount <= SCALE_MEDIUM_MAXIMUM_CELL_COUNT
        ? 2
        : 3;
  const elementCount = vehicleCount + fixedAreaCount;
  const elementStrength: ParkingJamLeverStrength =
    elementCount <= SCALE_FEW_MAXIMUM_ELEMENT_COUNT
      ? 1
      : elementCount <= SCALE_MODERATE_MAXIMUM_ELEMENT_COUNT
        ? 2
        : 3;
  return Math.min(areaStrength, elementStrength) as ParkingJamLeverStrength;
}

/** 状態空間を解析できない問題（車両数が厳密解析の上限を超える）ではレバーを求められない。 */
export function calculateParkingJamChallengeLevers(
  features: ParkingJamDifficultyFeatures,
): ParkingJamChallengeLevers | null {
  if (features.maximumPrerequisiteVehicleCount === null) return null;
  return {
    dependency: classifyDependencyLever(
      features.dependencyDepth,
      features.maximumPrerequisiteVehicleCount,
    ),
    misread: classifyMisreadLever(
      features.misreadInducingVehicleCount,
      features.vehicleCount,
    ),
    scale: classifyScaleLever(
      features.boardCellCount,
      features.vehicleCount,
      features.fixedAreaCount,
    ),
  };
}

type ParkingJamLevelLevers = {
  dependency: ParkingJamLeverStrength;
  misread: ParkingJamLeverStrength;
  scale: NumericRange<ParkingJamLeverStrength>;
};

export const parkingJamLevelLevers = {
  "1": { dependency: 1, misread: 1, scale: { minimum: 1, maximum: 2 } },
  "2": { dependency: 1, misread: 2, scale: { minimum: 1, maximum: 2 } },
  "3": { dependency: 2, misread: 2, scale: { minimum: 1, maximum: 3 } },
  "4": { dependency: 2, misread: 3, scale: { minimum: 2, maximum: 3 } },
  "5": { dependency: 3, misread: 3, scale: { minimum: 2, maximum: 3 } },
} as const satisfies Record<ParkingJamDifficulty, ParkingJamLevelLevers>;

/**
 * - `out-of-range`: 評価できるが、仕様の「難易度」で出さないとする問題。
 * - `unsupported`: 車両数が厳密解析の上限を超え、評価できない。
 */
export type ParkingJamDifficultyAssessment = DifficultyAssessment<{
  classified: { levers: ParkingJamChallengeLevers };
  outOfRange:
    | { reason: "too-light" | "too-heavy" }
    | { reason: "unlisted-combination"; levers: ParkingJamChallengeLevers };
  unsupported: NoAssessmentDetail;
  invalid: never;
}>;

function matchesLevelLevers(
  levers: ParkingJamChallengeLevers,
  level: ParkingJamLevelLevers,
): boolean {
  return (
    levers.dependency === level.dependency &&
    levers.misread === level.misread &&
    isInNumericRange(levers.scale, level.scale)
  );
}

export function assessParkingJamDifficulty(
  analysis: ParkingJamDifficultyAnalysis,
): ParkingJamDifficultyAssessment {
  const { features } = analysis;
  const levers = calculateParkingJamChallengeLevers(features);
  if (analysis.status === "unsupported" || levers === null) {
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

  const difficulty = difficultyLevels.find(({ id }) =>
    matchesLevelLevers(levers, parkingJamLevelLevers[id]),
  )?.id;
  return difficulty
    ? { status: "classified", difficulty, levers }
    : { status: "out-of-range", reason: "unlisted-combination", levers };
}
