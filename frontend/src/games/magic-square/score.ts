import type { MagicSquareSolveWorkload } from "@/games/magic-square/problem/problem";
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

/** 速さを主に、置いた数の取り下げを補助にする。並びは結果画面に出す順。 */
export const MAGIC_SQUARE_SCORE_MAXIMUMS = {
  speed: 70,
  accuracy: 30,
} as const satisfies ScoreMaximums<"speed" | "accuracy">;

/** 取り下げ1回の減点。正確さは取り下げ10回で0点になる。 */
export const MAGIC_SQUARE_WITHDRAWAL_PENALTY = 3;

/** 基準時間の、盤面と合計を読み始めるまでの時間。 */
export const MAGIC_SQUARE_SPEED_INITIAL_RECOGNITION_MS = 20_000;
/** 基準時間の、空きマス1つごとに入る数を確かめて置く時間。 */
export const MAGIC_SQUARE_SPEED_PER_EMPTY_CELL_MS = 10_000;
/** 速さが0点になる時間の、基準時間に対する倍率。 */
export const MAGIC_SQUARE_SPEED_ZERO_SCORE_RATIO = 2;

export type MagicSquarePlayScore = PlayScore<
  keyof typeof MAGIC_SQUARE_SCORE_MAXIMUMS
>;

type MagicSquareTimeDeltaInput = {
  elapsedMs: number;
  workload: MagicSquareSolveWorkload;
};

type MagicSquarePlayScoreInput = MagicSquareTimeDeltaInput & {
  withdrawalCount: number;
};

export function calculateMagicSquareSpeedFullScoreMs({
  emptyCellCount,
}: MagicSquareSolveWorkload): number {
  return (
    MAGIC_SQUARE_SPEED_INITIAL_RECOGNITION_MS +
    Math.max(0, emptyCellCount) * MAGIC_SQUARE_SPEED_PER_EMPTY_CELL_MS
  );
}

export function calculateMagicSquareSpeedScoreRule(
  workload: MagicSquareSolveWorkload,
): SpeedScoreRule {
  return createSpeedScoreRule(
    calculateMagicSquareSpeedFullScoreMs(workload),
    MAGIC_SQUARE_SPEED_ZERO_SCORE_RATIO,
  );
}

/** 基準時間に対するクリア時間の差。負なら基準より速い。 */
export function calculateMagicSquareTimeDeltaMs({
  elapsedMs,
  workload,
}: MagicSquareTimeDeltaInput): number {
  return calculateTimeDeltaMs(
    elapsedMs,
    calculateMagicSquareSpeedScoreRule(workload),
  );
}

/** 正確さは置いた数の取り下げで減らす。答えとの照合は使わない。待った・盤面を戻すは、それで外れた数の取り下げとして数える。 */
export function calculateMagicSquarePlayScore({
  elapsedMs,
  withdrawalCount,
  workload,
}: MagicSquarePlayScoreInput): MagicSquarePlayScore {
  const speed = calculateSpeedScore(
    MAGIC_SQUARE_SCORE_MAXIMUMS.speed,
    elapsedMs,
    calculateMagicSquareSpeedScoreRule(workload),
  );
  const accuracy = subtractWithFloor(
    MAGIC_SQUARE_SCORE_MAXIMUMS.accuracy,
    withdrawalCount * MAGIC_SQUARE_WITHDRAWAL_PENALTY,
  );
  return sumPlayScore({ speed, accuracy });
}
