import type { ReflectionSolveWorkload } from "@/games/reflection/problem/problem";
import {
  calculateSpeedScore,
  calculateTimeDeltaMs,
  createSpeedScoreRule,
  type PlayScore,
  type ScoreMaximums,
  type SpeedScoreRule,
  sumPlayScore,
} from "@/games/score";

export const REFLECTION_SCORE_MAXIMUMS = {
  speed: 100,
} as const satisfies ScoreMaximums<"speed">;

// 基準時間の係数は人間の実測（レベル5 の問題を熟練者が読んで3分8秒、同じ人のレベル5 の記録6件）で水準を合わせた暫定値で、
// 速さの減り方の倍率は仮置き。
// どちらも実プレイを重ねて校正する（`リフレクション成績評価.md` §15）。
/** 基準時間の係数（暫定）。外周ヒント1本ごとの盤面把握の時間。 */
export const REFLECTION_SPEED_PER_CLUE_MS = 500;
/** 基準時間の係数（暫定）。置くピース1個ごとの時間。 */
export const REFLECTION_SPEED_PER_PIECE_MS = 3_500;
/** 基準時間の係数（暫定）。全外周ヒントへ照らし直す1回ごとの時間。 */
export const REFLECTION_SPEED_PER_PROPAGATION_ROUND_MS = 1_250;
/** 基準時間の係数（暫定）。候補を仮に置いて確かめる1回ごとの時間。 */
export const REFLECTION_SPEED_PER_ASSUMPTION_TEST_MS = 3_500;
/**
 * 基準時間に数える、仮に置いて確かめた回数の上限（仮置き）。
 * 解法器は候補を端から順に試すので、回数の裾が長い（問題集の最大776回）。人間は見込みの高い候補から試すとみなし、上限で打ち切る。
 */
export const REFLECTION_SPEED_ASSUMPTION_TEST_LIMIT = 10;
/** 基準時間の係数（暫定）。一致表示を見ながら1本ずつ満たす試し置きの1手（ピースを選んで置き、一致を見る）ごとの時間。 */
export const REFLECTION_SPEED_PER_TRIAL_MOVE_MS = 5_000;

/**
 * 速さの減り始めの直線を延ばすと0点になる時間の、基準時間に対する倍率（仮置き）。曲線の傾きを決める（`calculateSpeedScore`）。
 * 基準時間の1.2倍以内で great、1.4倍以内で good に残る傾きにする。
 */
export const REFLECTION_SPEED_ZERO_SCORE_RATIO = 3;

export type ReflectionPlayScore = PlayScore<
  keyof typeof REFLECTION_SCORE_MAXIMUMS
>;

type ReflectionPlayScoreInput = {
  elapsedMs: number;
  workload: ReflectionSolveWorkload;
};

export function calculateReflectionReadingMs({
  pieceCount,
  clueCount,
  propagationRoundCount,
  assumptionTestCount,
}: ReflectionSolveWorkload): number {
  return (
    Math.max(0, clueCount) * REFLECTION_SPEED_PER_CLUE_MS +
    Math.max(0, pieceCount) * REFLECTION_SPEED_PER_PIECE_MS +
    Math.max(0, propagationRoundCount) *
      REFLECTION_SPEED_PER_PROPAGATION_ROUND_MS +
    Math.min(
      Math.max(0, assumptionTestCount),
      REFLECTION_SPEED_ASSUMPTION_TEST_LIMIT,
    ) *
      REFLECTION_SPEED_PER_ASSUMPTION_TEST_MS
  );
}

export function calculateReflectionTrialMs({
  clueCount,
  trialMoveCount,
}: ReflectionSolveWorkload): number {
  return trialMoveCount === null
    ? Infinity
    : Math.max(0, clueCount) * REFLECTION_SPEED_PER_CLUE_MS +
        Math.max(0, trialMoveCount) * REFLECTION_SPEED_PER_TRIAL_MOVE_MS;
}

/**
 * 一致表示があると、外周ヒント同士が干渉しない問題は試し置きの方が速く解けるので、その分だけ基準を縮める。
 * 読んで解く人が不利になりすぎないよう、試し置きの時間そのものまでは縮めない。
 */
export function calculateReflectionSpeedFullScoreMs(
  workload: ReflectionSolveWorkload,
): number {
  const readingMs = calculateReflectionReadingMs(workload);
  return (
    (readingMs + Math.min(readingMs, calculateReflectionTrialMs(workload))) / 2
  );
}

export function calculateReflectionSpeedScoreRule(
  workload: ReflectionSolveWorkload,
): SpeedScoreRule {
  return createSpeedScoreRule(
    calculateReflectionSpeedFullScoreMs(workload),
    REFLECTION_SPEED_ZERO_SCORE_RATIO,
  );
}

/** 基準時間に対するクリア時間の差。負なら基準より速い。 */
export function calculateReflectionTimeDeltaMs({
  elapsedMs,
  workload,
}: ReflectionPlayScoreInput): number {
  return calculateTimeDeltaMs(
    elapsedMs,
    calculateReflectionSpeedScoreRule(workload),
  );
}

export function calculateReflectionPlayScore({
  elapsedMs,
  workload,
}: ReflectionPlayScoreInput): ReflectionPlayScore {
  const speed = calculateSpeedScore(
    REFLECTION_SCORE_MAXIMUMS.speed,
    elapsedMs,
    calculateReflectionSpeedScoreRule(workload),
  );

  return sumPlayScore({ speed });
}
