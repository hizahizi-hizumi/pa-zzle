import type { ParkingJamDifficultyAnalysis } from "@/games/parking-jam/problem/difficulty-analysis";
import type {
  ParkingJamBoard,
  ParkingJamMove,
  ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import type { ProblemSeed } from "@/games/problem-seed";

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

export type ParkingJamProblemIdentity = {
  generatorVersion: typeof PARKING_JAM_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: ParkingJamGenerationConditions;
  generationAttempt: number;
};

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isFiniteUnitInterval(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

/** 記録など外部から読み戻した値が、現在の生成器で復元できる識別情報かを確かめる。 */
export function isParkingJamProblemIdentity(
  value: unknown,
): value is ParkingJamProblemIdentity {
  if (!value || typeof value !== "object") return false;

  const identity = value as Partial<ParkingJamProblemIdentity>;
  const conditions = identity.conditions;
  return (
    identity.generatorVersion === PARKING_JAM_GENERATOR_VERSION &&
    typeof identity.seed === "string" &&
    !!conditions &&
    typeof conditions === "object" &&
    isPositiveInteger(conditions.width) &&
    isPositiveInteger(conditions.height) &&
    isPositiveInteger(conditions.vehicleCount) &&
    isPositiveInteger(conditions.roadOpeningCount) &&
    isPositiveInteger(conditions.roadOpeningSpan) &&
    isNonNegativeInteger(conditions.fixedAreaCount) &&
    isPositiveInteger(conditions.fixedAreaLength) &&
    isFiniteUnitInterval(conditions.blockingPlacementProbability) &&
    isPositiveInteger(identity.generationAttempt)
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
