import type { GameResultLevel } from "@/games/result";

export const MINESWEEPER_SCORE_MAXIMUMS = {
  accuracy: 70,
  speed: 30,
} as const;

/**
 * 地雷を1つ踏むごとの正確性の減点。
 * 1つでも踏めば速さによらず great に届かず、踏んだ後も解き切る価値は残る重さにする。
 */
export const MINESWEEPER_MISTAKE_PENALTY = 15;

export const MINESWEEPER_SPEED_INITIAL_RECOGNITION_MS = 5_000;
export const MINESWEEPER_SPEED_PER_MINIMUM_OPEN_MS = 2_000;
export const MINESWEEPER_SPEED_PER_MINE_MS = 4_000;

export type MinesweeperPlayScore = {
  total: number;
  breakdown: {
    accuracy: number;
    speed: number;
  };
};

type MinesweeperSpeedFullScoreInput = {
  minimumOpenCount: number;
  mineCount: number;
};

type MinesweeperPlayScoreInput = MinesweeperSpeedFullScoreInput & {
  elapsedMs: number;
  mistakeCount: number;
};

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * 問題ごとの速さ満点基準時間。
 * 盤面把握の時間に、開く操作の最小回数と、見極める地雷の数に応じた時間を足す。
 * 問題の作業量だけから決め、難易度そのものは使わない。
 */
export function calculateMinesweeperSpeedFullScoreMs({
  minimumOpenCount,
  mineCount,
}: MinesweeperSpeedFullScoreInput): number {
  return (
    MINESWEEPER_SPEED_INITIAL_RECOGNITION_MS +
    Math.max(0, minimumOpenCount) * MINESWEEPER_SPEED_PER_MINIMUM_OPEN_MS +
    Math.max(0, mineCount) * MINESWEEPER_SPEED_PER_MINE_MS
  );
}

export function calculateMinesweeperTimeDeltaMs({
  elapsedMs,
  minimumOpenCount,
  mineCount,
}: MinesweeperSpeedFullScoreInput & { elapsedMs: number }): number {
  return (
    elapsedMs -
    calculateMinesweeperSpeedFullScoreMs({ minimumOpenCount, mineCount })
  );
}

export function calculateMinesweeperPlayScore({
  elapsedMs,
  mistakeCount,
  minimumOpenCount,
  mineCount,
}: MinesweeperPlayScoreInput): MinesweeperPlayScore {
  const accuracy = Math.max(
    0,
    MINESWEEPER_SCORE_MAXIMUMS.accuracy -
      mistakeCount * MINESWEEPER_MISTAKE_PENALTY,
  );

  const speedFullScoreMs = calculateMinesweeperSpeedFullScoreMs({
    minimumOpenCount,
    mineCount,
  });
  const overtimeMs = Math.max(0, elapsedMs - speedFullScoreMs);
  const speed = Math.round(
    MINESWEEPER_SCORE_MAXIMUMS.speed *
      clampUnit(1 - overtimeMs / speedFullScoreMs),
  );

  return {
    total: accuracy + speed,
    breakdown: { accuracy, speed },
  };
}

export function getMinesweeperGameResultLevel(score: number): GameResultLevel {
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
