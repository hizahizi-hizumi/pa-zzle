import { createProblemPoolIdLookup } from "@/games/problem-id";
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

/** 問題集の1項目を読み解いた値。問題は生成器で復元する。 */
export type WaterSortDecodedPoolEntry = {
  identity: WaterSortProblemIdentity;
  optimalMoveCount: number;
  stuckRate: number;
};

/** 問題集から復元した1問。評価の基準になる最短手数を伴う。 */
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

const findPoolPositionByProblemId = createProblemPoolIdLookup(
  problemPool.levels,
  (entry) => decodeWaterSortPoolEntry(entry).identity,
);

/** 難易度の問題集から問題 ID で1問を探す。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findWaterSortPoolEntryByProblemId(
  difficulty: WaterSortDifficulty,
  problemId: string,
): WaterSortProblemPoolEntry | null {
  return findPoolPositionByProblemId(difficulty, problemId)?.entry ?? null;
}
