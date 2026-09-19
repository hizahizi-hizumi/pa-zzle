import type { GameResultLevel } from "@/games/game-result";

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

  const completionOverage = Math.max(0, completionMoveCount - optimalMoveCount);
  const efficiency = calculateLinearScore(
    WATER_SORT_SCORE_MAXIMUMS.efficiency,
    1 - completionOverage / optimalMoveCount,
  );

  const speedFullScoreMs = calculateWaterSortSpeedFullScoreMs({
    optimalMoveCount,
    colorCount,
  });
  const speedOvertimeMs = Math.max(0, elapsedMs - speedFullScoreMs);
  const speed = calculateLinearScore(
    WATER_SORT_SCORE_MAXIMUMS.speed,
    1 - speedOvertimeMs / speedFullScoreMs,
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
