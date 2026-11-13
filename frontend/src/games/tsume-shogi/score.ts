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
import type { TsumeShogiSolveWorkload } from "@/games/tsume-shogi/problem/problem";

/** 係数はすべて実プレイで確かめる前の仮置き（`詰将棋成績評価.md`）。 */
export const TSUME_SHOGI_SCORE_MAXIMUMS = {
  accuracy: 20,
  speed: 80,
} as const satisfies ScoreMaximums<"accuracy" | "speed">;

export const TSUME_SHOGI_WRONG_CHECK_PENALTY = 5;

/** 基準時間の係数（仮置き）。盤面と持駒を見渡す時間。 */
export const TSUME_SHOGI_SPEED_INITIAL_RECOGNITION_MS = 8_000;
/** 基準時間の係数（仮置き）。攻方の1手ごとの、駒を選んで指し、玉方の応手（間を含む）を見る時間。 */
export const TSUME_SHOGI_SPEED_PER_ATTACKER_MOVE_MS = 4_000;
/** 基準時間の係数（仮置き）。初手の王手の候補1つごとの、王手になることを見つけて候補に挙げる時間。 */
export const TSUME_SHOGI_SPEED_PER_ROOT_CHECK_MS = 2_000;
/** 基準時間の係数（仮置き）。もっともらしい誤王手1つごとの、玉方の逃れを見つけて捨てる時間。 */
export const TSUME_SHOGI_SPEED_PER_PLAUSIBLE_WRONG_MS = 4_000;
/** 基準時間の係数（仮置き）。深い紛れ1つごとに足す、逃れの先の王手まで読む時間。 */
export const TSUME_SHOGI_SPEED_PER_DEEP_DECOY_MS = 6_000;
/**
 * 基準時間に数える、もっともらしい誤王手と深い紛れの上限（仮置き）。
 * 分析器はすべての判断地点の誤王手を数えるので裾が長い（問題集の最大はもっともらしい誤王手41・深い紛れ26）。
 */
export const TSUME_SHOGI_SPEED_PLAUSIBLE_WRONG_LIMIT = 20;
export const TSUME_SHOGI_SPEED_DEEP_DECOY_LIMIT = 10;

/**
 * 速さの減り始めの直線を延ばすと0点になる時間の、基準時間に対する倍率（仮置き）。曲線の傾きを決める（`calculateSpeedScore`）。リフレクションと同じく、基準時間の1.2倍以内で速さ72点・1.4倍以内で64点に残る傾き。
 */
export const TSUME_SHOGI_SPEED_ZERO_SCORE_RATIO = 3;

export type TsumeShogiPlayScore = PlayScore<
  keyof typeof TSUME_SHOGI_SCORE_MAXIMUMS
>;

type TsumeShogiPlayScoreInput = {
  elapsedMs: number;
  wrongCheckCount: number;
  workload: TsumeShogiSolveWorkload;
};

export function countTsumeShogiAttackerMoves(plies: number): number {
  return Math.ceil(Math.max(0, plies) / 2);
}

export function calculateTsumeShogiSpeedFullScoreMs({
  plies,
  rootChecks,
  plausibleWrong,
  deepDecoyCount,
}: TsumeShogiSolveWorkload): number {
  return (
    TSUME_SHOGI_SPEED_INITIAL_RECOGNITION_MS +
    countTsumeShogiAttackerMoves(plies) *
      TSUME_SHOGI_SPEED_PER_ATTACKER_MOVE_MS +
    Math.max(0, rootChecks) * TSUME_SHOGI_SPEED_PER_ROOT_CHECK_MS +
    Math.min(
      Math.max(0, plausibleWrong),
      TSUME_SHOGI_SPEED_PLAUSIBLE_WRONG_LIMIT,
    ) *
      TSUME_SHOGI_SPEED_PER_PLAUSIBLE_WRONG_MS +
    Math.min(Math.max(0, deepDecoyCount), TSUME_SHOGI_SPEED_DEEP_DECOY_LIMIT) *
      TSUME_SHOGI_SPEED_PER_DEEP_DECOY_MS
  );
}

export function calculateTsumeShogiSpeedScoreRule(
  workload: TsumeShogiSolveWorkload,
): SpeedScoreRule {
  return createSpeedScoreRule(
    calculateTsumeShogiSpeedFullScoreMs(workload),
    TSUME_SHOGI_SPEED_ZERO_SCORE_RATIO,
  );
}

/** 基準時間に対するクリア時間の差。負なら基準より速い。 */
export function calculateTsumeShogiTimeDeltaMs({
  elapsedMs,
  workload,
}: Pick<TsumeShogiPlayScoreInput, "elapsedMs" | "workload">): number {
  return calculateTimeDeltaMs(
    elapsedMs,
    calculateTsumeShogiSpeedScoreRule(workload),
  );
}

export function calculateTsumeShogiPlayScore({
  elapsedMs,
  wrongCheckCount,
  workload,
}: TsumeShogiPlayScoreInput): TsumeShogiPlayScore {
  const accuracy = subtractWithFloor(
    TSUME_SHOGI_SCORE_MAXIMUMS.accuracy,
    Math.max(0, wrongCheckCount) * TSUME_SHOGI_WRONG_CHECK_PENALTY,
  );

  const speed = calculateSpeedScore(
    TSUME_SHOGI_SCORE_MAXIMUMS.speed,
    elapsedMs,
    calculateTsumeShogiSpeedScoreRule(workload),
  );

  return sumPlayScore({ accuracy, speed });
}
