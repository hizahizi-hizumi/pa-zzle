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

const poolIndex = createProblemPoolIndex(
  problemPool.levels,
  (entry) => decodeWaterSortPoolEntry(entry).identity,
);

/** 難易度の問題集の全問の問題 ID を、問題集の並び順で返す。 */
export function listWaterSortPoolProblemIds(
  difficulty: WaterSortDifficulty,
): readonly ProblemId[] {
  return poolIndex.listProblemIds(difficulty);
}

/** 難易度の問題集から問題 ID で1問を探す。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findWaterSortPoolEntryByProblemId(
  difficulty: WaterSortDifficulty,
  problemId: string,
): WaterSortProblemPoolEntry | null {
  return poolIndex.findPositionById(difficulty, problemId)?.entry ?? null;
}

/** 始めたときの盤面を見れば分かる、問題の特徴。 */
export type WaterSortProblemFeatures = {
  colorCount: number;
  emptyBottleCount: number;
};

/** 難易度の問題集の1問の特徴を、問題を復元せずに問題集の項目から求める。問題集に無い ID・別の難易度の ID には `null` を返す。 */
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
