export const SUDOKU_SCORE_MAXIMUMS = {
  accuracy: 40,
  speed: 40,
  stability: 20,
} as const;

export const SUDOKU_MISTAKE_PENALTY = 5;
export const SUDOKU_SPEED_FULL_SCORE_MS = 15 * 60 * 1_000;
export const SUDOKU_SPEED_PENALTY_INTERVAL_MS = 60 * 1_000;
export const SUDOKU_SPEED_PENALTY_PER_INTERVAL = 1;
export const SUDOKU_UNDO_PENALTY = 2;
export const SUDOKU_RESTART_PENALTY = 5;

export type SudokuPlayScore = {
  total: number;
  breakdown: {
    accuracy: number;
    speed: number;
    stability: number;
  };
};

type SudokuPlayScoreInput = {
  elapsedMs: number;
  mistakeCount: number;
  undoCount: number;
  restartCount: number;
};

function subtractWithFloor(maximum: number, penalty: number): number {
  return Math.max(0, maximum - penalty);
}

export function calculateSudokuPlayScore({
  elapsedMs,
  mistakeCount,
  undoCount,
  restartCount,
}: SudokuPlayScoreInput): SudokuPlayScore {
  const accuracy = subtractWithFloor(
    SUDOKU_SCORE_MAXIMUMS.accuracy,
    mistakeCount * SUDOKU_MISTAKE_PENALTY,
  );

  const overtimeMs = Math.max(0, elapsedMs - SUDOKU_SPEED_FULL_SCORE_MS);
  const overtimeIntervals = Math.ceil(
    overtimeMs / SUDOKU_SPEED_PENALTY_INTERVAL_MS,
  );
  const speed = subtractWithFloor(
    SUDOKU_SCORE_MAXIMUMS.speed,
    overtimeIntervals * SUDOKU_SPEED_PENALTY_PER_INTERVAL,
  );

  const stability = subtractWithFloor(
    SUDOKU_SCORE_MAXIMUMS.stability,
    undoCount * SUDOKU_UNDO_PENALTY + restartCount * SUDOKU_RESTART_PENALTY,
  );

  return {
    total: accuracy + speed + stability,
    breakdown: { accuracy, speed, stability },
  };
}
