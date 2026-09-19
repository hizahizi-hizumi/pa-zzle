import type { ProblemSeed } from "@/games/problem-seed";
import type {
  WATER_SORT_BOTTLE_CAPACITY,
  WATER_SORT_EMPTY_BOTTLE_COUNT,
  WaterSortState,
} from "../puzzle/state";
import type { WaterSortDifficultyAnalysis } from "./difficulty-analysis";

export const WATER_SORT_GENERATOR_VERSION = "1";

export type WaterSortGenerationConditions = {
  colorCount: number;
  capacity: typeof WATER_SORT_BOTTLE_CAPACITY;
  emptyBottleCount: typeof WATER_SORT_EMPTY_BOTTLE_COUNT;
};

export type WaterSortProblem = {
  initialState: WaterSortState;
};

export type WaterSortProblemIdentity = {
  generatorVersion: typeof WATER_SORT_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: WaterSortGenerationConditions;
  generationAttempt: number;
};

export type WaterSortGeneratedProblem = WaterSortProblem & {
  identity: WaterSortProblemIdentity;
  optimalMoveCount: number;
  difficultyAnalysis: WaterSortDifficultyAnalysis;
};
