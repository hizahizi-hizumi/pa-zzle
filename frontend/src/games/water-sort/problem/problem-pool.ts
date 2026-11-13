import {
  createCountFeatureValue,
  type ProblemFeatureAxis,
} from "@/games/problem-feature";
import { createProblemPoolIndex, type ProblemId } from "@/games/problem-id";
import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import {
  WATER_SORT_GENERATOR_VERSION,
  type WaterSortIdentifiedProblem,
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

export type WaterSortDecodedPoolEntry = {
  identity: WaterSortProblemIdentity;
  optimalMoveCount: number;
  stuckRate: number;
};

export type WaterSortPooledProblem = WaterSortIdentifiedProblem & {
  optimalMoveCount: number;
};

const problemPool = problemPoolJson as unknown as WaterSortProblemPool;

export function decodeWaterSortPoolEntry([
  seed,
  colorCount,
  emptyBottleCount,
  generationAttempt,
  optimalMoveCount,
  stuckRate,
]: WaterSortProblemPoolEntry): WaterSortDecodedPoolEntry {
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

const poolIndex = createProblemPoolIndex(
  problemPool.levels,
  (entry) => decodeWaterSortPoolEntry(entry).identity,
);

export function listWaterSortPoolProblemIds(
  difficulty: WaterSortDifficulty,
): readonly ProblemId[] {
  return poolIndex.listProblemIds(difficulty);
}

export function findWaterSortPoolEntryByProblemId(
  difficulty: WaterSortDifficulty,
  problemId: string,
): WaterSortProblemPoolEntry | null {
  return poolIndex.findPositionById(difficulty, problemId)?.entry ?? null;
}

export type WaterSortProblemFeatures = {
  colorCount: number;
  emptyBottleCount: number;
};

export function findWaterSortPoolProblemFeatures(
  difficulty: WaterSortDifficulty,
  problemId: string,
): WaterSortProblemFeatures | null {
  const entry = findWaterSortPoolEntryByProblemId(difficulty, problemId);
  if (!entry) {
    return null;
  }
  const { colorCount, emptyBottleCount } =
    decodeWaterSortPoolEntry(entry).identity.conditions;
  return { colorCount, emptyBottleCount };
}

export const waterSortProblemFeatureAxes = [
  {
    id: "color-count",
    getValue({ colorCount }) {
      return createCountFeatureValue(colorCount);
    },
  },
  {
    id: "empty-bottle-count",
    getValue({ emptyBottleCount }) {
      return createCountFeatureValue(emptyBottleCount);
    },
  },
] as const satisfies readonly ProblemFeatureAxis<WaterSortProblemFeatures>[];

export type WaterSortProblemFeatureAxisId =
  (typeof waterSortProblemFeatureAxes)[number]["id"];
