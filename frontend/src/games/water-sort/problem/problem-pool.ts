import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import {
  WATER_SORT_GENERATOR_VERSION,
  type WaterSortProblemIdentity,
} from "@/games/water-sort/problem/problem";
import problemPoolJson from "@/games/water-sort/problem/problem-pool.json";
import { WATER_SORT_BOTTLE_CAPACITY } from "@/games/water-sort/puzzle/state";

export type WaterSortProblemPoolEntry = readonly [
  seed: string,
  colorCount: number,
  emptyBottleCount: number,
  generationAttempt: number,
  optimalMoveCount: number,
  stuckRate: number,
];

export type WaterSortProblemPool = {
  generatorVersion: typeof WATER_SORT_GENERATOR_VERSION;
  levels: Record<WaterSortDifficulty, readonly WaterSortProblemPoolEntry[]>;
};

export type WaterSortPooledProblem = {
  identity: WaterSortProblemIdentity;
  optimalMoveCount: number;
  stuckRate: number;
};

const problemPool = problemPoolJson as unknown as WaterSortProblemPool;

export function toWaterSortPooledProblem([
  seed,
  colorCount,
  emptyBottleCount,
  generationAttempt,
  optimalMoveCount,
  stuckRate,
]: WaterSortProblemPoolEntry): WaterSortPooledProblem {
  return {
    identity: {
      generatorVersion: WATER_SORT_GENERATOR_VERSION,
      seed,
      conditions: {
        colorCount,
        capacity: WATER_SORT_BOTTLE_CAPACITY,
        emptyBottleCount,
      },
      generationAttempt,
    },
    optimalMoveCount,
    stuckRate,
  };
}

export function listWaterSortPoolEntries(
  difficulty: WaterSortDifficulty,
): readonly WaterSortProblemPoolEntry[] {
  return problemPool.levels[difficulty];
}
