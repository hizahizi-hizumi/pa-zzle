import type { BridgesSolveWorkload } from "@/games/bridges/problem/workload";
import {
  calculateSpeedScore,
  calculateTimeDeltaMs,
  createSpeedScoreRule,
  type PlayScore,
  type ScoreMaximums,
  type SpeedScoreRule,
  sumPlayScore,
} from "@/games/score";

/**
 * 数字とつながりを読んで、迷わず速く全島をつなぐことを称える。問題ごとの基準時間と比べた速さだけで100点満点にする。
 * 架け直し・待った・盤面を戻す・交差に阻まれた回数は減点しない。架けて本数の知らせを見ながら直すことがこのゲームの中心の操作で、
 * それを減点すると遊び方そのもの（押し間違いも含む）を罰するため。直した分は時間にだけ表れる。
 * 基準時間の係数と0点になる倍率は、人の実プレイで校正する前の暫定値。
 */
export const BRIDGES_SCORE_MAXIMUMS = {
  speed: 100,
} as const satisfies ScoreMaximums<"speed">;

/** 基準時間の係数（暫定）。盤面を見渡して始める時間。 */
export const BRIDGES_SPEED_INITIAL_RECOGNITION_MS = 8_000;
/** 基準時間の係数（暫定）。島1つの数字と行き先を見比べる時間。 */
export const BRIDGES_SPEED_PER_ISLAND_MS = 1_000;
/** 基準時間の係数（暫定）。橋1本を架ける操作の時間（2本の組は2回）。 */
export const BRIDGES_SPEED_PER_BRIDGE_MS = 800;
/** 基準時間の係数（暫定）。「ちょうど」で止まり、「少なくとも1本」の読みを探す手詰まり1回ごとの時間。 */
export const BRIDGES_SPEED_PER_COUNT_ROUND_MS = 3_000;
/** 基準時間の係数（暫定）。数字の読みで止まり、つながりを読む所を探す手詰まり1回ごとの時間。 */
export const BRIDGES_SPEED_PER_CONNECTIVITY_ROUND_MS = 6_000;
/** 基準時間の係数（暫定）。数字の読みだけでは決まらない行き先1つを、つながりを読んで決める時間。 */
export const BRIDGES_SPEED_PER_UNDECIDED_EDGE_MS = 1_000;

/**
 * 0点になる時間の、基準時間に対する倍率（暫定）。
 * つながりの読みの当たり外れで時間がぶれるので、リフレクション・一筆パズルと同じ3倍にし、
 * 基準時間の1.2倍以内で great、1.4倍以内で good に残る傾きにする。
 */
export const BRIDGES_SPEED_ZERO_SCORE_RATIO = 3;

export type BridgesPlayScore = PlayScore<keyof typeof BRIDGES_SCORE_MAXIMUMS>;

type BridgesPlayScoreInput = {
  elapsedMs: number;
  workload: BridgesSolveWorkload;
};

/**
 * 問題ごとの速さ満点の基準時間。盤面を見渡す時間に、島の数、橋の本数、「少なくとも1本」の読みとつながりの読みの手詰まりの回数、
 * 数字だけでは決まらない行き先の数に応じた時間を足す。問題を解き切る作業の量だけから決め、難易度そのものは使わない。
 * 行き先の数は島の数と橋の本数に強く連動するので使わない。
 */
export function calculateBridgesSpeedFullScoreMs({
  islandCount,
  bridgeCount,
  countRoundCount,
  connectivityRoundCount,
  countReasoningUndecidedEdgeCount,
}: BridgesSolveWorkload): number {
  return (
    BRIDGES_SPEED_INITIAL_RECOGNITION_MS +
    Math.max(0, islandCount) * BRIDGES_SPEED_PER_ISLAND_MS +
    Math.max(0, bridgeCount) * BRIDGES_SPEED_PER_BRIDGE_MS +
    Math.max(0, countRoundCount) * BRIDGES_SPEED_PER_COUNT_ROUND_MS +
    Math.max(0, connectivityRoundCount) *
      BRIDGES_SPEED_PER_CONNECTIVITY_ROUND_MS +
    Math.max(0, countReasoningUndecidedEdgeCount) *
      BRIDGES_SPEED_PER_UNDECIDED_EDGE_MS
  );
}

export function calculateBridgesSpeedScoreRule(
  workload: BridgesSolveWorkload,
): SpeedScoreRule {
  return createSpeedScoreRule(
    calculateBridgesSpeedFullScoreMs(workload),
    BRIDGES_SPEED_ZERO_SCORE_RATIO,
  );
}

/** 基準時間に対するクリア時間の差。負なら基準より速い。 */
export function calculateBridgesTimeDeltaMs({
  elapsedMs,
  workload,
}: BridgesPlayScoreInput): number {
  return calculateTimeDeltaMs(
    elapsedMs,
    calculateBridgesSpeedScoreRule(workload),
  );
}

export function calculateBridgesPlayScore({
  elapsedMs,
  workload,
}: BridgesPlayScoreInput): BridgesPlayScore {
  const speed = calculateSpeedScore(
    BRIDGES_SCORE_MAXIMUMS.speed,
    elapsedMs,
    calculateBridgesSpeedScoreRule(workload),
  );

  return sumPlayScore({ speed });
}
