import type { ProblemSeed } from "@/games/problem-seed";
import type {
  ParkingJamBoard,
  ParkingJamMove,
  ParkingJamVehicleId,
} from "../puzzle/board";
import type { ParkingJamDifficultyAnalysis } from "./difficulty-analysis";

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
