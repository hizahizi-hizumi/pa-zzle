import type { GameResultLevel } from "@/games/result";

export const FIFTEEN_PUZZLE_SCORE_MAXIMUMS = {
  efficiency: 60,
  speed: 40,
} as const;

export const FIFTEEN_PUZZLE_SPEED_INITIAL_RECOGNITION_MS = 10_000;
export const FIFTEEN_PUZZLE_SPEED_PER_OPTIMAL_MOVE_MS = 2_000;

export type FifteenPuzzlePlayScore = {
  total: number;
  breakdown: {
    efficiency: number;
    speed: number;
  };
};

type FifteenPuzzleSpeedFullScoreInput = {
  optimalMoveCount: number;
};

type FifteenPuzzleTimeDeltaInput = FifteenPuzzleSpeedFullScoreInput & {
  elapsedMs: number;
};

type FifteenPuzzleMoveDeltaInput = {
  /** 盤面を戻す前の手も含む、動いたタイルの総枚数。 */
  moveCount: number;
  optimalMoveCount: number;
};

type FifteenPuzzlePlayScoreInput = FifteenPuzzleTimeDeltaInput &
  FifteenPuzzleMoveDeltaInput;

type FifteenPuzzlePerformanceComparison = {
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

function calculateFifteenPuzzleSpeedFullScoreMs({
  optimalMoveCount,
}: FifteenPuzzleSpeedFullScoreInput): number {
  return (
    FIFTEEN_PUZZLE_SPEED_INITIAL_RECOGNITION_MS +
    Math.max(0, optimalMoveCount) * FIFTEEN_PUZZLE_SPEED_PER_OPTIMAL_MOVE_MS
  );
}

export function calculateFifteenPuzzleTimeDeltaMs({
  elapsedMs,
  optimalMoveCount,
}: FifteenPuzzleTimeDeltaInput): number {
  return (
    elapsedMs - calculateFifteenPuzzleSpeedFullScoreMs({ optimalMoveCount })
  );
}

export function calculateFifteenPuzzleMoveDelta({
  moveCount,
  optimalMoveCount,
}: FifteenPuzzleMoveDeltaInput): number {
  return moveCount - optimalMoveCount;
}

export function calculateFifteenPuzzlePerformanceComparison({
  elapsedMs,
  moveCount,
  optimalMoveCount,
}: FifteenPuzzlePlayScoreInput): FifteenPuzzlePerformanceComparison {
  const speedFullScoreMs = calculateFifteenPuzzleSpeedFullScoreMs({
    optimalMoveCount,
  });

  return {
    speedFullScoreMs,
    timeDeltaMs: calculateFifteenPuzzleTimeDeltaMs({
      elapsedMs,
      optimalMoveCount,
    }),
    moveDelta: calculateFifteenPuzzleMoveDelta({
      moveCount,
      optimalMoveCount,
    }),
  };
}

/**
 * 効率は「最短手数 ÷ 総手数」の比で評価する。人の手数は最短の数倍になりやすく、
 * 超過分で線形に減らすと中位の上達差が 0 点に潰れるため。
 * 総手数は盤面を戻す前の手も含むので、やり直しを別に減点しない。
 */
export function calculateFifteenPuzzlePlayScore({
  elapsedMs,
  moveCount,
  optimalMoveCount,
}: FifteenPuzzlePlayScoreInput): FifteenPuzzlePlayScore {
  const comparison = calculateFifteenPuzzlePerformanceComparison({
    elapsedMs,
    moveCount,
    optimalMoveCount,
  });

  const efficiency =
    optimalMoveCount <= 0 || moveCount <= optimalMoveCount
      ? FIFTEEN_PUZZLE_SCORE_MAXIMUMS.efficiency
      : calculateLinearScore(
          FIFTEEN_PUZZLE_SCORE_MAXIMUMS.efficiency,
          optimalMoveCount / moveCount,
        );

  const speedOvertimeMs = Math.max(0, comparison.timeDeltaMs);
  const speed = calculateLinearScore(
    FIFTEEN_PUZZLE_SCORE_MAXIMUMS.speed,
    1 - speedOvertimeMs / comparison.speedFullScoreMs,
  );

  return {
    total: efficiency + speed,
    breakdown: { efficiency, speed },
  };
}

export function getFifteenPuzzleGameResultLevel(
  score: number,
): GameResultLevel {
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

export const _private = { calculateFifteenPuzzleSpeedFullScoreMs };
