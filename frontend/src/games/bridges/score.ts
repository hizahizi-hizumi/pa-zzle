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

export const BRIDGES_SCORE_MAXIMUMS = {
  speed: 100,
} as const satisfies ScoreMaximums<"speed">;

// 基準時間の係数（暫定）。人の記録は無いので、評価役と作り手が手で解いた所見の、読みの種類ごとの時間から置く
// （成績評価の文書 §3.8・§3.9）。
export const BRIDGES_SPEED_INITIAL_RECOGNITION_MS = 10_000;
/** 島1つの数字と行き先を見比べる時間。 */
export const BRIDGES_SPEED_PER_ISLAND_MS = 1_000;
/** 橋1本を架ける操作の時間（2本の組は2回押す）。押す所を目で追い、押して、本数の知らせを確かめる。 */
export const BRIDGES_SPEED_PER_BRIDGE_MS = 1_500;
/** 「少なくとも1本」の配分を探して読む、数字の読みのまとまり1つごとの時間。 */
export const BRIDGES_SPEED_PER_COUNT_ROUND_MS = 15_000;
/** 数字の読みで止まり、閉じる組・唯一の通り道を探して読む手詰まり1回ごとの時間。盤面を見回して組をたどる。 */
export const BRIDGES_SPEED_PER_CONNECTIVITY_ROUND_MS = 40_000;
/** 架かると決まった橋と交わって消えた、両端の島がまだ足りない行き先1つを見つけて数字の読みへ戻す時間。 */
export const BRIDGES_SPEED_PER_CROSSING_BLOCK_MS = 4_000;
/**
 * つながりの手詰まりのうち、1手の先読みが要った1回ごとに足す時間。手を1つ仮に決め、両端の島を埋め、本数が破れるか組が閉じるかを
 * 確かめる2段の読みで、つながりの手詰まりを探す時間に加えてかかる。
 */
export const BRIDGES_SPEED_PER_LOOKAHEAD_ROUND_MS = 110_000;
/** 数字の読みだけでは決まらない行き先1つを、つながりを読んで決める時間。 */
export const BRIDGES_SPEED_PER_UNDECIDED_EDGE_MS = 1_000;

// 速さの減り始めの直線を延ばすと0点になる時間の、基準時間に対する倍率（暫定）。曲線の傾きを決める（`calculateSpeedScore`）。
export const BRIDGES_SPEED_BASE_ZERO_SCORE_RATIO = 3;
export const BRIDGES_SPEED_READING_ZERO_SCORE_RATIO = 3;

export type BridgesPlayScore = PlayScore<keyof typeof BRIDGES_SCORE_MAXIMUMS>;

type BridgesPlayScoreInput = {
  elapsedMs: number;
  workload: BridgesSolveWorkload;
};

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
