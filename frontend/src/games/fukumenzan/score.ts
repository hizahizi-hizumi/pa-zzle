import type { FukumenzanWorkload } from "@/games/fukumenzan/problem/workload";
import {
  calculateSpeedScore,
  calculateTimeDeltaMs,
  createSpeedScoreRule,
  type PlayScore,
  type ScoreMaximums,
  type SpeedScoreRule,
  sumPlayScore,
} from "@/games/score";

export const FUKUMENZAN_SCORE_MAXIMUMS = {
  speed: 100,
} as const satisfies ScoreMaximums<"speed">;

/** 式を見て、どの桁から読むかを決めるまでの時間。 */
export const FUKUMENZAN_SPEED_INITIAL_RECOGNITION_MS = 20_000;
/** 文字1つの数字を、桁の足し算と違う数字の約束から絞って決め、札を入れる時間。 */
export const FUKUMENZAN_SPEED_PER_LETTER_MS = 15_000;
/** 式の文字1つを、桁ごとに見比べて読む時間。 */
export const FUKUMENZAN_SPEED_PER_LETTER_CELL_MS = 1_000;
/** 0点になる時間の、基準時間に対する倍率。 */
export const FUKUMENZAN_SPEED_ZERO_SCORE_RATIO = 3;

export type FukumenzanPlayScore = PlayScore<
  keyof typeof FUKUMENZAN_SCORE_MAXIMUMS
>;

type FukumenzanPlayScoreInput = {
  elapsedMs: number;
  workload: FukumenzanWorkload;
};

export function calculateFukumenzanSpeedFullScoreMs({
  letterCount,
  letterCellCount,
}: FukumenzanWorkload): number {
  return (
    FUKUMENZAN_SPEED_INITIAL_RECOGNITION_MS +
    letterCount * FUKUMENZAN_SPEED_PER_LETTER_MS +
    letterCellCount * FUKUMENZAN_SPEED_PER_LETTER_CELL_MS
  );
}

export function calculateFukumenzanSpeedScoreRule(
  workload: FukumenzanWorkload,
): SpeedScoreRule {
  return createSpeedScoreRule(
    calculateFukumenzanSpeedFullScoreMs(workload),
    FUKUMENZAN_SPEED_ZERO_SCORE_RATIO,
  );
}

export function calculateFukumenzanTimeDeltaMs({
  elapsedMs,
  workload,
}: FukumenzanPlayScoreInput): number {
  return calculateTimeDeltaMs(
    elapsedMs,
    calculateFukumenzanSpeedScoreRule(workload),
  );
}

export function calculateFukumenzanPlayScore({
  elapsedMs,
  workload,
}: FukumenzanPlayScoreInput): FukumenzanPlayScore {
  const speed = calculateSpeedScore(
    FUKUMENZAN_SCORE_MAXIMUMS.speed,
    elapsedMs,
    calculateFukumenzanSpeedScoreRule(workload),
  );

  return sumPlayScore({ speed });
}
