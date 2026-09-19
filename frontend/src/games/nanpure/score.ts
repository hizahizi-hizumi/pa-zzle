export const NANPURE_SCORE_MAXIMUMS = {
  accuracy: 40,
  speed: 40,
  stability: 20,
} as const;

export const NANPURE_MISTAKE_PENALTY = 5;
export const NANPURE_SPEED_FULL_SCORE_MS = 15 * 60 * 1_000;
export const NANPURE_SPEED_PENALTY_INTERVAL_MS = 60 * 1_000;
export const NANPURE_SPEED_PENALTY_PER_INTERVAL = 1;
export const NANPURE_UNDO_PENALTY = 2;
export const NANPURE_RESTART_PENALTY = 5;

export type NanpurePlayScore = {
  total: number;
  breakdown: {
    accuracy: number;
    speed: number;
    stability: number;
  };
};

type NanpurePlayScoreInput = {
  elapsedMs: number;
  mistakeCount: number;
  undoCount: number;
  restartCount: number;
};

function subtractWithFloor(maximum: number, penalty: number): number {
  return Math.max(0, maximum - penalty);
}

export function calculateNanpurePlayScore({
  elapsedMs,
  mistakeCount,
  undoCount,
  restartCount,
}: NanpurePlayScoreInput): NanpurePlayScore {
  const accuracy = subtractWithFloor(
    NANPURE_SCORE_MAXIMUMS.accuracy,
    mistakeCount * NANPURE_MISTAKE_PENALTY,
  );

  const overtimeMs = Math.max(0, elapsedMs - NANPURE_SPEED_FULL_SCORE_MS);
  const overtimeIntervals = Math.ceil(
    overtimeMs / NANPURE_SPEED_PENALTY_INTERVAL_MS,
  );
  const speed = subtractWithFloor(
    NANPURE_SCORE_MAXIMUMS.speed,
    overtimeIntervals * NANPURE_SPEED_PENALTY_PER_INTERVAL,
  );

  const stability = subtractWithFloor(
    NANPURE_SCORE_MAXIMUMS.stability,
    undoCount * NANPURE_UNDO_PENALTY + restartCount * NANPURE_RESTART_PENALTY,
  );

  return {
    total: accuracy + speed + stability,
    breakdown: { accuracy, speed, stability },
  };
}
