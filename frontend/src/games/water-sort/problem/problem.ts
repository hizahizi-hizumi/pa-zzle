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

/** 初期状態は、色ごとに瓶の容量と同じ数のブロックがあり、空でない瓶は満杯で、空の瓶を1本以上持つ。 */
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

/** 記録・診断など外部から読み戻した値が、現在の生成器で復元できる識別情報かを確かめる。 */
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

/** 記録に残した問題の識別情報。生成器の版が今と違う記録も、採点に使う色数が読めれば読み込む。 */
export type WaterSortRecordedProblemIdentity = RecordedProblemIdentity<{
  colorCount: number;
}>;

/** 記録から読み戻した値が、問題の識別情報として読めるかを確かめる。 */
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

export type WaterSortGeneratedProblem = {
  problem: WaterSortProblem;
  identity: WaterSortProblemIdentity;
  optimalMoveCount: number;
};
