import {
  calculateLinearScore,
  calculateSpeedScore,
  calculateTimeDeltaMs,
  createSpeedScoreRule,
  type PlayScore,
  type ScoreMaximums,
  type SpeedScoreRule,
  sumPlayScore,
} from "@/games/score";

export const WATER_SORT_SCORE_MAXIMUMS = {
  efficiency: 40,
  speed: 40,
  accuracy: 20,
} as const satisfies ScoreMaximums<"efficiency" | "speed" | "accuracy">;

export const WATER_SORT_SPEED_INITIAL_RECOGNITION_MS = 5_000;
export const WATER_SORT_SPEED_PER_COLOR_MS = 1_500;
export const WATER_SORT_SPEED_PER_OPTIMAL_MOVE_MS = 5_000;
/** 速さが0点になる時間の、基準時間に対する倍率。 */
export const WATER_SORT_SPEED_ZERO_SCORE_RATIO = 2;

export type WaterSortPlayScore = PlayScore<
  keyof typeof WATER_SORT_SCORE_MAXIMUMS
>;

type WaterSortPlayScoreInput = {
  elapsedMs: number;
  moveCount: number;
  completionMoveCount: number;
  optimalMoveCount: number;
  colorCount: number;
};

type WaterSortSpeedFullScoreInput = {
  optimalMoveCount: number;
  colorCount: number;
};

type WaterSortTimeDeltaInput = WaterSortSpeedFullScoreInput & {
  elapsedMs: number;
};

type WaterSortMoveDeltaInput = {
  completionMoveCount: number;
  optimalMoveCount: number;
};

export function calculateWaterSortSpeedFullScoreMs({
  optimalMoveCount,
  colorCount,
}: WaterSortSpeedFullScoreInput): number {
  return (
    WATER_SORT_SPEED_INITIAL_RECOGNITION_MS +
    Math.max(0, colorCount) * WATER_SORT_SPEED_PER_COLOR_MS +
    Math.max(0, optimalMoveCount) * WATER_SORT_SPEED_PER_OPTIMAL_MOVE_MS
  );
}

export function calculateWaterSortSpeedScoreRule(
  input: WaterSortSpeedFullScoreInput,
): SpeedScoreRule {
  return createSpeedScoreRule(
    calculateWaterSortSpeedFullScoreMs(input),
    WATER_SORT_SPEED_ZERO_SCORE_RATIO,
  );
}

export function calculateWaterSortTimeDeltaMs({
  elapsedMs,
  ...input
}: WaterSortTimeDeltaInput): number {
  return calculateTimeDeltaMs(
    elapsedMs,
    calculateWaterSortSpeedScoreRule(input),
  );
}

export function calculateWaterSortMoveDelta({
  completionMoveCount,
  optimalMoveCount,
}: WaterSortMoveDeltaInput): number {
  return completionMoveCount - optimalMoveCount;
}

export function calculateWaterSortPlayScore({
  elapsedMs,
  moveCount,
  completionMoveCount,
  optimalMoveCount,
  colorCount,
}: WaterSortPlayScoreInput): WaterSortPlayScore {
  if (optimalMoveCount <= 0) {
    return sumPlayScore({ ...WATER_SORT_SCORE_MAXIMUMS });
  }

  const completionOverage = Math.max(
    0,
    calculateWaterSortMoveDelta({ completionMoveCount, optimalMoveCount }),
  );
  const efficiency = calculateLinearScore(
    WATER_SORT_SCORE_MAXIMUMS.efficiency,
    1 - completionOverage / optimalMoveCount,
  );

  const speed = calculateSpeedScore(
    WATER_SORT_SCORE_MAXIMUMS.speed,
    elapsedMs,
    calculateWaterSortSpeedScoreRule({ optimalMoveCount, colorCount }),
  );

  const backtrackMoveCount = Math.max(0, moveCount - completionMoveCount);
  const accuracy = calculateLinearScore(
    WATER_SORT_SCORE_MAXIMUMS.accuracy,
    1 - backtrackMoveCount / optimalMoveCount,
  );

  return sumPlayScore({ efficiency, speed, accuracy });
}
