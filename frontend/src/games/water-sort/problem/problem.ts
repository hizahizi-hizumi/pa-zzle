import type { ProblemSeed } from "@/games/problem-seed";
import {
  WATER_SORT_BOTTLE_CAPACITY,
  type WaterSortState,
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

/** 記録・診断など外部から読み戻した値が、現在の生成器で復元できる識別情報かを確かめる。 */
export function isWaterSortProblemIdentity(
  value: unknown,
): value is WaterSortProblemIdentity {
  if (!isRecordObject(value) || !isRecordObject(value.conditions)) {
    return false;
  }

  return (
    value.generatorVersion === WATER_SORT_GENERATOR_VERSION &&
    typeof value.seed === "string" &&
    isPositiveInteger(value.conditions.colorCount) &&
    value.conditions.capacity === WATER_SORT_BOTTLE_CAPACITY &&
    isPositiveInteger(value.conditions.emptyBottleCount) &&
    isPositiveInteger(value.generationAttempt)
  );
}

export type WaterSortGeneratedProblem = {
  problem: WaterSortProblem;
  identity: WaterSortProblemIdentity;
  optimalMoveCount: number;
};

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
