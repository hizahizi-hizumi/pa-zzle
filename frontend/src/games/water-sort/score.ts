import type { GameResultLevel } from "@/games/result";

export const WATER_SORT_SCORE_MAXIMUMS = {
  efficiency: 40,
  speed: 40,
  accuracy: 20,
} as const;

export const WATER_SORT_SPEED_INITIAL_RECOGNITION_MS = 5_000;
export const WATER_SORT_SPEED_PER_COLOR_MS = 1_500;
export const WATER_SORT_SPEED_PER_OPTIMAL_MOVE_MS = 5_000;

export type WaterSortPlayScore = {
  total: number;
  breakdown: {
    efficiency: number;
    speed: number;
    accuracy: number;
  };
};

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

type WaterSortPerformanceComparisonInput = WaterSortSpeedFullScoreInput & {
  elapsedMs: number;
  completionMoveCount: number;
};

type WaterSortTimeDeltaInput = WaterSortSpeedFullScoreInput & {
  elapsedMs: number;
};

type WaterSortMoveDeltaInput = {
  completionMoveCount: number;
  optimalMoveCount: number;
};

export type WaterSortPerformanceComparison = {
  speedFullScoreMs: number;
  timeDeltaMs: number;
  moveDelta: number;
};

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function calculateLinearScore(maximum: number, ratio: number): number {
  return Math.round(maximum * clampUnit(ratio));
}

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

export function calculateWaterSortTimeDeltaMs({
  elapsedMs,
  optimalMoveCount,
  colorCount,
}: WaterSortTimeDeltaInput): number {
  return (
    elapsedMs -
    calculateWaterSortSpeedFullScoreMs({ optimalMoveCount, colorCount })
  );
}

export function calculateWaterSortMoveDelta({
  completionMoveCount,
  optimalMoveCount,
}: WaterSortMoveDeltaInput): number {
  return completionMoveCount - optimalMoveCount;
}

export function calculateWaterSortPerformanceComparison({
  elapsedMs,
  completionMoveCount,
  optimalMoveCount,
  colorCount,
}: WaterSortPerformanceComparisonInput): WaterSortPerformanceComparison {
  const speedFullScoreMs = calculateWaterSortSpeedFullScoreMs({
    optimalMoveCount,
    colorCount,
  });

  return {
    speedFullScoreMs,
    timeDeltaMs: elapsedMs - speedFullScoreMs,
    moveDelta: calculateWaterSortMoveDelta({
      completionMoveCount,
      optimalMoveCount,
    }),
  };
}

export function calculateWaterSortPlayScore({
  elapsedMs,
  moveCount,
  completionMoveCount,
  optimalMoveCount,
  colorCount,
}: WaterSortPlayScoreInput): WaterSortPlayScore {
  if (optimalMoveCount <= 0) {
    return {
      total: 100,
      breakdown: {
        efficiency: WATER_SORT_SCORE_MAXIMUMS.efficiency,
        speed: WATER_SORT_SCORE_MAXIMUMS.speed,
        accuracy: WATER_SORT_SCORE_MAXIMUMS.accuracy,
      },
    };
  }

  const comparison = calculateWaterSortPerformanceComparison({
    elapsedMs,
    completionMoveCount,
    optimalMoveCount,
    colorCount,
  });
  const completionOverage = Math.max(0, comparison.moveDelta);
  const efficiency = calculateLinearScore(
    WATER_SORT_SCORE_MAXIMUMS.efficiency,
    1 - completionOverage / optimalMoveCount,
  );

  const speedOvertimeMs = Math.max(0, comparison.timeDeltaMs);
  const speed = calculateLinearScore(
    WATER_SORT_SCORE_MAXIMUMS.speed,
    1 - speedOvertimeMs / comparison.speedFullScoreMs,
  );

  const backtrackMoveCount = Math.max(0, moveCount - completionMoveCount);
  const accuracy = calculateLinearScore(
    WATER_SORT_SCORE_MAXIMUMS.accuracy,
    1 - backtrackMoveCount / optimalMoveCount,
  );

  return {
    total: efficiency + speed + accuracy,
    breakdown: { efficiency, speed, accuracy },
  };
}

export function getWaterSortGameResultLevel(score: number): GameResultLevel {
  if (score >= 100) {
    return "perfect";
  }
  if (score >= 90) {
    return "great";
  }
  if (score >= 80) {
    return "good";
  }
  return "clear";
}
