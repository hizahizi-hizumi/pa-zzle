import type { ReflectionSolveWorkload } from "@/games/reflection/problem/problem";
import type { GameResultLevel } from "@/games/result";

/**
 * 解き切る速さを称える。問題ごとの基準時間と比べた速さだけで100点満点にする。
 * 置き直し・盤面を戻した回数・光路を確かめた回数は減点しない。一致表示を見ながら置いて確かめ、動かして直すことが
 * このゲームの中心の操作で、それを減点すると遊び方そのもの（押し間違いも含む）を罰するため。
 * 基準時間の係数と0点になる倍率は仮置きで、実プレイで校正する（`リフレクション成績評価.md`）。
 */
export const REFLECTION_SCORE_MAXIMUM = 100;

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

/**
 * 0点になる時間の、基準時間に対する倍率（仮置き）。
 * 基準時間の1.2倍以内で great、1.4倍以内で good に残る傾きにする。
 */
export const REFLECTION_SPEED_ZERO_SCORE_RATIO = 3;

type ReflectionPlayScoreInput = {
  elapsedMs: number;
  workload: ReflectionSolveWorkload;
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

/** 0点になる時間。基準時間から、ここまで超過に応じて線形に減らす。 */
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
}: ReflectionPlayScoreInput): number {
  return elapsedMs - calculateReflectionSpeedFullScoreMs(workload);
}

/**
 * 基準時間以内で満点、超過に応じて線形に減らし、0点になる時間（基準時間の3倍）で0点とする。1点単位に四捨五入する。
 */
export function calculateReflectionPlayScore({
  elapsedMs,
  workload,
}: ReflectionPlayScoreInput): number {
  const speedFullScoreMs = calculateReflectionSpeedFullScoreMs(workload);
  const speedZeroScoreMs = calculateReflectionSpeedZeroScoreMs(workload);
  const overtimeMs = Math.max(0, elapsedMs - speedFullScoreMs);
  return Math.round(
    REFLECTION_SCORE_MAXIMUM *
      clampUnit(1 - overtimeMs / (speedZeroScoreMs - speedFullScoreMs)),
  );
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
