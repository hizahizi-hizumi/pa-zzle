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
import type { TakuzuSolveWorkload } from "@/games/takuzu/problem/problem";

export const TAKUZU_SCORE_MAXIMUMS = {
  accuracy: 60,
  speed: 40,
} as const satisfies ScoreMaximums<"accuracy" | "speed">;

export const TAKUZU_CORRECTION_PENALTY = 5;

export const TAKUZU_RESTART_PENALTY = 15;

/** ナンプレの待ったと同じ重さにする。 */
export const TAKUZU_UNDO_PENALTY = 2;

export const TAKUZU_SPEED_INITIAL_RECOGNITION_MS = 10_000;
export const TAKUZU_SPEED_PER_EMPTY_CELL_MS = 2_000;
export const TAKUZU_SPEED_PER_ROUND_MS = 3_000;
export const TAKUZU_SPEED_PER_LINE_READING_ROUND_MS = 10_000;

/** 速さの減り始めの直線を延ばすと0点になる時間の、基準時間に対する倍率。曲線の傾きを決める（`calculateSpeedScore`）。 */
export const TAKUZU_SPEED_ZERO_SCORE_RATIO = 2;

export type TakuzuPlayScore = PlayScore<keyof typeof TAKUZU_SCORE_MAXIMUMS>;

type TakuzuTimeDeltaInput = {
  elapsedMs: number;
  workload: TakuzuSolveWorkload;
};

type TakuzuPlayScoreInput = TakuzuTimeDeltaInput & {
  correctionCount: number;
  restartCount: number;
  undoCount: number;
};

export function calculateTakuzuSpeedFullScoreMs({
  emptyCellCount,
  roundCount,
  lineReadingRoundCount,
}: TakuzuSolveWorkload): number {
  return (
    TAKUZU_SPEED_INITIAL_RECOGNITION_MS +
    Math.max(0, emptyCellCount) * TAKUZU_SPEED_PER_EMPTY_CELL_MS +
    Math.max(0, roundCount) * TAKUZU_SPEED_PER_ROUND_MS +
    Math.max(0, lineReadingRoundCount) * TAKUZU_SPEED_PER_LINE_READING_ROUND_MS
  );
}

export function calculateTakuzuSpeedScoreRule(
  workload: TakuzuSolveWorkload,
): SpeedScoreRule {
  return createSpeedScoreRule(
    calculateTakuzuSpeedFullScoreMs(workload),
    TAKUZU_SPEED_ZERO_SCORE_RATIO,
  );
}

/** 基準時間に対するクリア時間の差。負なら基準より速い。 */
export function calculateTakuzuTimeDeltaMs({
  elapsedMs,
  workload,
}: TakuzuTimeDeltaInput): number {
  return calculateTimeDeltaMs(
    elapsedMs,
    calculateTakuzuSpeedScoreRule(workload),
  );
}

/** 正確さは置き直しの回数、盤面を戻した回数、待ったの回数に応じて減点する。解答との照合は使わない。 */
export function calculateTakuzuPlayScore({
  elapsedMs,
  correctionCount,
  restartCount,
  undoCount,
  workload,
}: TakuzuPlayScoreInput): TakuzuPlayScore {
  const accuracy = subtractWithFloor(
    TAKUZU_SCORE_MAXIMUMS.accuracy,
    correctionCount * TAKUZU_CORRECTION_PENALTY +
      restartCount * TAKUZU_RESTART_PENALTY +
      undoCount * TAKUZU_UNDO_PENALTY,
  );

  const speed = calculateSpeedScore(
    TAKUZU_SCORE_MAXIMUMS.speed,
    elapsedMs,
    calculateTakuzuSpeedScoreRule(workload),
  );

  return sumPlayScore({ accuracy, speed });
}
