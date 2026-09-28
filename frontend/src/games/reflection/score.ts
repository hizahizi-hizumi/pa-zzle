import type { ReflectionSolveWorkload } from "@/games/reflection/problem/problem";
import type { GameResultLevel } from "@/games/result";

/**
 * 外周ヒントから置き場所を確定させてから置き、置いたピースを動かし直さずに解き切ることを最も称え、その上で速さを称える。
 * 配点・減点幅・基準時間の係数はすべて仮置きで、実プレイで校正する（`リフレクション成績評価.md`）。
 */
export const REFLECTION_SCORE_MAXIMUMS = {
  accuracy: 60,
  speed: 40,
} as const;

/**
 * 置き直し1回ごとの正確性の減点（仮置き）。
 * 置き直し2回までは great に残り、5回以上は速さによらず good に届かない重さにする。
 */
export const REFLECTION_RELOCATION_PENALTY = 5;

/**
 * 盤面を戻した1回ごとの正確性の減点（仮置き）。
 * 盤面を戻してストックへ戻ったピースは置き直しに数えないので、試し置きの跡をまとめて消せる分を含めて重くする。
 * 1回戻せば、ほかが完璧でも最高で good とする。
 */
export const REFLECTION_RESTART_PENALTY = 15;

/** 基準時間の係数（仮置き）。外周ヒント1本ごとの盤面把握の時間。 */
export const REFLECTION_SPEED_PER_CLUE_MS = 500;
/** 基準時間の係数（仮置き）。置くピース1個ごとの時間。 */
export const REFLECTION_SPEED_PER_PIECE_MS = 6_000;
/** 基準時間の係数（仮置き）。全外周ヒントへ照らし直す1回ごとの時間。 */
export const REFLECTION_SPEED_PER_PROPAGATION_ROUND_MS = 8_000;
/** 基準時間の係数（仮置き）。候補を仮に置いて確かめる1回ごとの時間。 */
export const REFLECTION_SPEED_PER_ASSUMPTION_TEST_MS = 15_000;
/**
 * 基準時間に数える、仮に置いて確かめた回数の上限（仮置き）。
 * 解法器は候補を端から順に試すので、回数の裾が長い（問題集の最大776回）。人間は見込みの高い候補から試すとみなし、上限で打ち切る。
 */
export const REFLECTION_SPEED_ASSUMPTION_TEST_LIMIT = 10;

/** 速さが0点になる時間の、基準時間に対する倍率（仮置き）。 */
export const REFLECTION_SPEED_ZERO_SCORE_RATIO = 2;

export type ReflectionPlayScore = {
  total: number;
  breakdown: {
    accuracy: number;
    speed: number;
  };
};

type ReflectionTimeDeltaInput = {
  elapsedMs: number;
  workload: ReflectionSolveWorkload;
};

type ReflectionPlayScoreInput = ReflectionTimeDeltaInput & {
  relocationCount: number;
  restartCount: number;
};

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * 問題ごとの速さ満点の基準時間。
 * 外周ヒントを読む時間に、置くピースの数、全外周ヒントへ照らし直す回数、候補を仮に置いて確かめる回数（上限あり）に応じた時間を足す。
 * 問題を解き切る作業の量だけから決め、難易度そのものは使わない。
 */
export function calculateReflectionSpeedFullScoreMs({
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

/** 速さが0点になる時間。基準時間から、ここまで超過に応じて線形に減らす。 */
export function calculateReflectionSpeedZeroScoreMs(
  workload: ReflectionSolveWorkload,
): number {
  return (
    calculateReflectionSpeedFullScoreMs(workload) *
    REFLECTION_SPEED_ZERO_SCORE_RATIO
  );
}

/** 基準時間に対するクリア時間の差。負なら基準より速い。 */
export function calculateReflectionTimeDeltaMs({
  elapsedMs,
  workload,
}: ReflectionTimeDeltaInput): number {
  return elapsedMs - calculateReflectionSpeedFullScoreMs(workload);
}

/**
 * - 正確性: 置き直しの回数と盤面を戻した回数に応じて減点する。解答との照合は使わない。
 *   光路を確かめた回数・入力回数は評価に使わない。
 * - 速さ: 基準時間以内で満点、超過に応じて線形に減らし、0点になる時間（基準時間の2倍）で0点とする。
 */
export function calculateReflectionPlayScore({
  elapsedMs,
  relocationCount,
  restartCount,
  workload,
}: ReflectionPlayScoreInput): ReflectionPlayScore {
  const accuracy = Math.max(
    0,
    REFLECTION_SCORE_MAXIMUMS.accuracy -
      relocationCount * REFLECTION_RELOCATION_PENALTY -
      restartCount * REFLECTION_RESTART_PENALTY,
  );

  const speedFullScoreMs = calculateReflectionSpeedFullScoreMs(workload);
  const speedZeroScoreMs = calculateReflectionSpeedZeroScoreMs(workload);
  const overtimeMs = Math.max(0, elapsedMs - speedFullScoreMs);
  const speed = Math.round(
    REFLECTION_SCORE_MAXIMUMS.speed *
      clampUnit(1 - overtimeMs / (speedZeroScoreMs - speedFullScoreMs)),
  );

  return {
    total: accuracy + speed,
    breakdown: { accuracy, speed },
  };
}

export function getReflectionGameResultLevel(score: number): GameResultLevel {
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
