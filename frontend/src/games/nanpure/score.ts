import {
  calculateSpeedScore,
  calculateTimeDeltaMs,
  type PlayScore,
  type ScoreMaximums,
  type SpeedScoreRule,
  subtractWithFloor,
  sumPlayScore,
} from "@/games/score";

export const NANPURE_SCORE_MAXIMUMS = {
  accuracy: 40,
  speed: 40,
  stability: 20,
} as const satisfies ScoreMaximums<"accuracy" | "speed" | "stability">;

export const NANPURE_MISTAKE_PENALTY = 5;
export const NANPURE_UNDO_PENALTY = 2;
export const NANPURE_RESTART_PENALTY = 5;

/** 速さの基準時間。問題の作業量によらず全問で共通にする。 */
export const NANPURE_SPEED_FULL_SCORE_MS = 15 * 60 * 1_000;
/** 速さを減らす超過時間の刻み。超過時間をこの幅で切り上げ、1刻みごとに1点減らす。 */
export const NANPURE_SPEED_PENALTY_INTERVAL_MS = 60 * 1_000;

/** 速さの採点規則。基準時間を過ぎてから満点分の刻みを数えると0点になる。 */
const NANPURE_SPEED_SCORE_RULE: SpeedScoreRule = {
  fullScoreMs: NANPURE_SPEED_FULL_SCORE_MS,
  zeroScoreMs:
    NANPURE_SPEED_FULL_SCORE_MS +
    NANPURE_SCORE_MAXIMUMS.speed * NANPURE_SPEED_PENALTY_INTERVAL_MS,
  overtimeStepMs: NANPURE_SPEED_PENALTY_INTERVAL_MS,
};

export type NanpurePlayScore = PlayScore<keyof typeof NANPURE_SCORE_MAXIMUMS>;

type NanpurePlayScoreInput = {
  elapsedMs: number;
  mistakeCount: number;
  undoCount: number;
  restartCount: number;
};

export function calculateNanpureSpeedScoreRule(): SpeedScoreRule {
  return NANPURE_SPEED_SCORE_RULE;
}

export function calculateNanpureTimeDeltaMs({
  elapsedMs,
}: {
  elapsedMs: number;
}): number {
  return calculateTimeDeltaMs(elapsedMs, NANPURE_SPEED_SCORE_RULE);
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

  const speed = calculateSpeedScore(
    NANPURE_SCORE_MAXIMUMS.speed,
    elapsedMs,
    NANPURE_SPEED_SCORE_RULE,
  );

  const stability = subtractWithFloor(
    NANPURE_SCORE_MAXIMUMS.stability,
    undoCount * NANPURE_UNDO_PENALTY + restartCount * NANPURE_RESTART_PENALTY,
  );

  return sumPlayScore({ accuracy, speed, stability });
}
