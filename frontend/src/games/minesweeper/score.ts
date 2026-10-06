import {
  calculateSpeedScore,
  calculateTimeDeltaMs,
  createSpeedScoreRule,
  type PlayScore,
  type ScoreMaximums,
  type SpeedScoreRule,
  subtractWithFloor,
  sumPlayScore,
} from "@/games/score";

export const MINESWEEPER_SCORE_MAXIMUMS = {
  accuracy: 60,
  speed: 40,
} as const satisfies ScoreMaximums<"accuracy" | "speed">;

/**
 * 地雷を1つ踏むごとの正確さの減点。
 * 1つでも踏めば速さによらず great に届かず、踏んだ後も解き切る価値は残る重さにする。
 */
export const MINESWEEPER_MISTAKE_PENALTY = 15;

export const MINESWEEPER_SPEED_INITIAL_RECOGNITION_MS = 5_000;
export const MINESWEEPER_SPEED_PER_MINIMUM_OPEN_MS = 2_000;
export const MINESWEEPER_SPEED_PER_MINE_MS = 4_000;
/** 速さが0点になる時間の、基準時間に対する倍率。 */
export const MINESWEEPER_SPEED_ZERO_SCORE_RATIO = 2;

export type MinesweeperPlayScore = PlayScore<
  keyof typeof MINESWEEPER_SCORE_MAXIMUMS
>;

type MinesweeperSpeedFullScoreInput = {
  minimumOpenCount: number;
  mineCount: number;
};

type MinesweeperPlayScoreInput = MinesweeperSpeedFullScoreInput & {
  elapsedMs: number;
  mistakeCount: number;
};

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

export function calculateMinesweeperSpeedScoreRule(
  input: MinesweeperSpeedFullScoreInput,
): SpeedScoreRule {
  return createSpeedScoreRule(
    calculateMinesweeperSpeedFullScoreMs(input),
    MINESWEEPER_SPEED_ZERO_SCORE_RATIO,
  );
}

export function calculateMinesweeperTimeDeltaMs({
  elapsedMs,
  ...input
}: MinesweeperSpeedFullScoreInput & { elapsedMs: number }): number {
  return calculateTimeDeltaMs(
    elapsedMs,
    calculateMinesweeperSpeedScoreRule(input),
  );
}

export function calculateMinesweeperPlayScore({
  elapsedMs,
  mistakeCount,
  minimumOpenCount,
  mineCount,
}: MinesweeperPlayScoreInput): MinesweeperPlayScore {
  const accuracy = subtractWithFloor(
    MINESWEEPER_SCORE_MAXIMUMS.accuracy,
    mistakeCount * MINESWEEPER_MISTAKE_PENALTY,
  );

  const speed = calculateSpeedScore(
    MINESWEEPER_SCORE_MAXIMUMS.speed,
    elapsedMs,
    calculateMinesweeperSpeedScoreRule({ minimumOpenCount, mineCount }),
  );

  return sumPlayScore({ accuracy, speed });
}
