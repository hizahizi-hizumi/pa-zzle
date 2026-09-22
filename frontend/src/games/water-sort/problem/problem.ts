import type { ProblemSeed } from "@/games/problem-seed";
import type { WaterSortDifficultyAnalysis } from "@/games/water-sort/problem/difficulty-analysis";
import type {
  WATER_SORT_BOTTLE_CAPACITY,
  WaterSortState,
} from "@/games/water-sort/puzzle/state";

export const WATER_SORT_GENERATOR_VERSION = "1";

export type WaterSortGenerationConditions = {
  colorCount: number;
  capacity: typeof WATER_SORT_BOTTLE_CAPACITY;
  emptyBottleCount: number;
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

export type WaterSortGeneratedProblem = {
  problem: WaterSortProblem;
  identity: WaterSortProblemIdentity;
  optimalMoveCount: number;
  difficultyAnalysis: WaterSortDifficultyAnalysis;
};
