import type { ParkingJamDifficultyAnalysis } from "@/games/parking-jam/problem/difficulty-analysis";
import {
  type ParkingJamBoard,
  type ParkingJamMove,
  type ParkingJamVehicleId,
  validateParkingJamBoard,
} from "@/games/parking-jam/puzzle/board";
import {
  isRecordedProblemIdentity,
  type RecordedProblemIdentity,
} from "@/games/problem-id";
import type { ProblemSeed } from "@/games/problem-seed";
import {
  isNonEmptyString,
  isNonNegativeInteger,
  isPositiveInteger,
  isRecordObject,
} from "@/lib/type-guards";

export const PARKING_JAM_GENERATOR_VERSION = "2";

export type ParkingJamGenerationConditions = {
  width: number;
  height: number;
  vehicleCount: number;
  roadOpeningCount: number;
  roadOpeningSpan: number;
  fixedAreaCount: number;
  fixedAreaLength: number;
  blockingPlacementProbability: number;
};

export type ParkingJamProblem = {
  board: ParkingJamBoard;
};

export function assertParkingJamProblem(problem: ParkingJamProblem): void {
  validateParkingJamBoard(problem.board);
}

export type ParkingJamProblemIdentity = {
  generatorVersion: typeof PARKING_JAM_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: ParkingJamGenerationConditions;
  generationAttempt: number;
};

function isUnitInterval(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

/** 記録・診断など外部から読み戻した値が、現在の生成器で復元できる識別情報かを確かめる。 */
export function isParkingJamProblemIdentity(
  value: unknown,
): value is ParkingJamProblemIdentity {
  if (!isRecordObject(value) || !isRecordObject(value.conditions)) {
    return false;
  }

  const { conditions } = value;
  return (
    value.generatorVersion === PARKING_JAM_GENERATOR_VERSION &&
    isNonEmptyString(value.seed) &&
    isPositiveInteger(conditions.width) &&
    isPositiveInteger(conditions.height) &&
    isPositiveInteger(conditions.vehicleCount) &&
    isPositiveInteger(conditions.roadOpeningCount) &&
    isPositiveInteger(conditions.roadOpeningSpan) &&
    isNonNegativeInteger(conditions.fixedAreaCount) &&
    isPositiveInteger(conditions.fixedAreaLength) &&
    isUnitInterval(conditions.blockingPlacementProbability) &&
    isPositiveInteger(value.generationAttempt)
  );
}

/** 記録に残した問題の識別情報。生成器の版が今と違う記録も、採点に使う車両数が読めれば読み込む。 */
export type ParkingJamRecordedProblemIdentity = RecordedProblemIdentity<{
  vehicleCount: number;
}>;

/** 記録から読み戻した値が、問題の識別情報として読めるかを確かめる。 */
export function isParkingJamRecordedProblemIdentity(
  value: unknown,
): value is ParkingJamRecordedProblemIdentity {
  return (
    isRecordedProblemIdentity(value, {
      generatorVersion: PARKING_JAM_GENERATOR_VERSION,
      isProblemIdentity: isParkingJamProblemIdentity,
    }) && isPositiveInteger(value.conditions.vehicleCount)
  );
}

export type ParkingJamSolvabilityAnalysis = {
  status: "solvable" | "unsolvable";
  solution: readonly ParkingJamMove[];
  removalLayers: readonly (readonly ParkingJamVehicleId[])[];
};

export type ParkingJamGeneratedProblem = {
  problem: ParkingJamProblem;
  identity: ParkingJamProblemIdentity;
  solvabilityAnalysis: ParkingJamSolvabilityAnalysis;
  difficultyAnalysis: ParkingJamDifficultyAnalysis;
};
