import {
  isRecordedProblemIdentity,
  type RecordedProblemIdentity,
} from "@/games/problem-id";
import type { ProblemSeed } from "@/games/problem-seed";
import {
  countEmptyWaterSortBottles,
  countWaterSortColors,
  isStandardWaterSortInitialState,
  WATER_SORT_BOTTLE_CAPACITY,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";
import {
  isNonEmptyString,
  isPositiveInteger,
  isRecordObject,
} from "@/lib/type-guards";

export const WATER_SORT_GENERATOR_VERSION = "1";

export type WaterSortGenerationConditions = {
  colorCount: number;
  capacity: typeof WATER_SORT_BOTTLE_CAPACITY;
  emptyBottleCount: number;
};

export type WaterSortProblem = {
  initialState: WaterSortState;
};

export function assertWaterSortProblem(problem: WaterSortProblem): void {
  const { initialState } = problem;
  if (
    !isStandardWaterSortInitialState(
      initialState,
      countWaterSortColors(initialState),
      countEmptyWaterSortBottles(initialState),
    )
  ) {
    throw new Error("Water sort initial state must be a standard puzzle");
  }
}

export type WaterSortProblemIdentity = {
  generatorVersion: typeof WATER_SORT_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: WaterSortGenerationConditions;
  generationAttempt: number;
};

export function isWaterSortProblemIdentity(
  value: unknown,
): value is WaterSortProblemIdentity {
  if (!isRecordObject(value) || !isRecordObject(value.conditions)) {
    return false;
  }

  return (
    value.generatorVersion === WATER_SORT_GENERATOR_VERSION &&
    isNonEmptyString(value.seed) &&
    isPositiveInteger(value.conditions.colorCount) &&
    value.conditions.capacity === WATER_SORT_BOTTLE_CAPACITY &&
    isPositiveInteger(value.conditions.emptyBottleCount) &&
    isPositiveInteger(value.generationAttempt)
  );
}

export type WaterSortRecordedProblemIdentity = RecordedProblemIdentity<{
  colorCount: number;
}>;

export function isWaterSortRecordedProblemIdentity(
  value: unknown,
): value is WaterSortRecordedProblemIdentity {
  return (
    isRecordedProblemIdentity(value, {
      generatorVersion: WATER_SORT_GENERATOR_VERSION,
      isProblemIdentity: isWaterSortProblemIdentity,
    }) && isPositiveInteger(value.conditions.colorCount)
  );
}

export type WaterSortIdentifiedProblem = {
  problem: WaterSortProblem;
  identity: WaterSortProblemIdentity;
};
