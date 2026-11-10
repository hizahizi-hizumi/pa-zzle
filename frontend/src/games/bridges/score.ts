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

/**
 * 基準時間の係数（暫定）。人の記録は無いので、評価役2人と作り手が手で解いた所見の、読みの種類ごとの時間から置く
 * （成績評価の文書 §3.8）。
 */
/** 盤面を見渡して始める時間。 */
export const BRIDGES_SPEED_INITIAL_RECOGNITION_MS = 10_000;
/** 島1つの数字と行き先を見比べる時間。 */
export const BRIDGES_SPEED_PER_ISLAND_MS = 1_000;
/** 橋1本を架ける操作の時間（2本の組は2回押す）。押す所を目で追い、押して、本数の知らせを確かめる。 */
export const BRIDGES_SPEED_PER_BRIDGE_MS = 1_500;
/** 「ちょうど」で止まり、「少なくとも1本」の配分を探して読む手詰まり1回ごとの時間。 */
export const BRIDGES_SPEED_PER_COUNT_ROUND_MS = 8_000;
/** 数字の読みで止まり、閉じる組・唯一の通り道を探して読む手詰まり1回ごとの時間。 */
export const BRIDGES_SPEED_PER_CONNECTIVITY_ROUND_MS = 20_000;
/** 架かると決まった橋と交わって消えた、両端の島がまだ足りない行き先1つを見つけて数字の読みへ戻す時間。 */
export const BRIDGES_SPEED_PER_CROSSING_BLOCK_MS = 4_000;
/**
 * つながりの手詰まりのうち、1手の先読みが要った1回ごとに足す時間。手を1つ仮に決め、両端の島を埋め、本数が破れるか組が閉じるかを
 * 確かめる2段の読みで、つながりの手詰まりを探す時間に加えてかかる。
 */
export const BRIDGES_SPEED_PER_LOOKAHEAD_ROUND_MS = 45_000;
/** 数字の読みだけでは決まらない行き先1つを、つながりを読んで決める時間。 */
export const BRIDGES_SPEED_PER_UNDECIDED_EDGE_MS = 1_000;

/**
 * 0点になる時間の、基準時間に対する倍率（暫定）。読みにかかる時間の割合が大きい問題ほど、人による時間のぶれが大きいので、
 * 0点の線を広げる。倍率は 3 に、基準時間のうち読みの項（配分・つながり・交差・先読み・決まらない行き先）の割合の3倍を足し、
 * 0.1 単位に丸める。読みの無い問題は3倍、読みが基準時間の半分なら 4.5倍になる。
 */
export const BRIDGES_SPEED_BASE_ZERO_SCORE_RATIO = 3;
export const BRIDGES_SPEED_READING_ZERO_SCORE_RATIO = 3;

export type BridgesPlayScore = PlayScore<keyof typeof BRIDGES_SCORE_MAXIMUMS>;

type BridgesPlayScoreInput = {
  elapsedMs: number;
  workload: BridgesSolveWorkload;
};

/** 基準時間のうち、読みの項（配分・つながり・交差・先読み・決まらない行き先）の時間。 */
function calculateReadingMs({
  countRoundCount,
  connectivityRoundCount,
  countReasoningUndecidedEdgeCount,
  lookaheadRoundCount = 0,
  crossingBlockCount = 0,
}: BridgesSolveWorkload): number {
  return (
    Math.max(0, countRoundCount) * BRIDGES_SPEED_PER_COUNT_ROUND_MS +
    Math.max(0, connectivityRoundCount) *
      BRIDGES_SPEED_PER_CONNECTIVITY_ROUND_MS +
    Math.max(0, crossingBlockCount) * BRIDGES_SPEED_PER_CROSSING_BLOCK_MS +
    Math.max(0, lookaheadRoundCount) * BRIDGES_SPEED_PER_LOOKAHEAD_ROUND_MS +
    Math.max(0, countReasoningUndecidedEdgeCount) *
      BRIDGES_SPEED_PER_UNDECIDED_EDGE_MS
  );
}

/**
 * 問題ごとの速さ満点の基準時間。盤面を見渡す時間に、島の数、橋を架ける操作の回数（橋の本数）、読みの項の時間を足す。
 * 問題を解き切る作業の量だけから決め、難易度そのものは使わない。行き先の数は島の数と橋の本数に強く連動するので使わない。
 */
export function calculateBridgesSpeedFullScoreMs(
  workload: BridgesSolveWorkload,
): number {
  return (
    BRIDGES_SPEED_INITIAL_RECOGNITION_MS +
    Math.max(0, workload.islandCount) * BRIDGES_SPEED_PER_ISLAND_MS +
    Math.max(0, workload.bridgeCount) * BRIDGES_SPEED_PER_BRIDGE_MS +
    calculateReadingMs(workload)
  );
}

/** 0点になる時間の、基準時間に対する倍率。 */
export function calculateBridgesZeroScoreRatio(
  workload: BridgesSolveWorkload,
): number {
  const readingShare =
    calculateReadingMs(workload) / calculateBridgesSpeedFullScoreMs(workload);
  return (
    Math.round(
      (BRIDGES_SPEED_BASE_ZERO_SCORE_RATIO +
        BRIDGES_SPEED_READING_ZERO_SCORE_RATIO * readingShare) *
        10,
    ) / 10
  );
}

export function calculateBridgesSpeedScoreRule(
  workload: BridgesSolveWorkload,
): SpeedScoreRule {
  return createSpeedScoreRule(
    calculateBridgesSpeedFullScoreMs(workload),
    calculateBridgesZeroScoreRatio(workload),
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
