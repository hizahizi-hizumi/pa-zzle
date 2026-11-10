import type { BridgesPooledProblem } from "@/games/bridges/problem/problem-pool";
import { getBridgesNetwork } from "@/games/bridges/puzzle/board";
import {
  isNonNegativeInteger,
  isPositiveInteger,
  isRecordObject,
} from "@/lib/type-guards";

/**
 * 問題を解き切る作業の量。速さの基準時間を問題ごとに決めるために使い、難易度そのものは表さない。
 * - `islandCount`: 島の数（読む数字の数）。
 * - `edgeCount`: 橋を架けられる島の組（行き先）の数。
 * - `bridgeCount`: 解の橋の本数の合計（2本の組は2と数える）。島の数字の合計の半分で、架ける操作の回数の下限。
 * - `countRoundCount`: 人間向け解法器で、「ちょうど」で止まり「少なくとも1本」の読みが要った手詰まりの回数。
 * - `connectivityRoundCount`: 数字の読みで止まり、つながりの読みが要った手詰まりの回数。
 * - `countReasoningUndecidedEdgeCount`: 数字の読みだけでは本数が決まらない行き先の数（つながりを読んで決める範囲）。
 * - `lookaheadRoundCount`: つながりの読みの手詰まりのうち、1手の先読みが要った回数。1手の先読みを数えるようになる前の
 *   記録には無い（0 とみなす）。
 */
export type BridgesSolveWorkload = {
  islandCount: number;
  edgeCount: number;
  bridgeCount: number;
  countRoundCount: number;
  connectivityRoundCount: number;
  countReasoningUndecidedEdgeCount: number;
  lookaheadRoundCount?: number;
};

/** 問題集の1問の作業の量。盤面から数えられる量と、問題集が持つ生成時の分析結果から求める。 */
export function measureBridgesSolveWorkload({
  problem,
  analysis,
}: BridgesPooledProblem): BridgesSolveWorkload {
  const clueTotal = problem.islands.reduce(
    (total, { clue }) => total + clue,
    0,
  );
  return {
    islandCount: problem.islands.length,
    edgeCount: getBridgesNetwork(problem).edges.length,
    bridgeCount: clueTotal / 2,
    countRoundCount: analysis.countRoundCount,
    connectivityRoundCount: analysis.connectivityRoundCount,
    countReasoningUndecidedEdgeCount: analysis.countReasoningUndecidedEdgeCount,
    lookaheadRoundCount: analysis.lookaheadRoundCount,
  };
}

/**
 * 記録など外部から読み戻した値が、作業の量として読めるかを確かめる。
 * 全島が1つにつながるので、行き先と橋の本数は島の数 − 1 以上。決まらない行き先は行き先の数を超えない。
 * 1手の先読みの回数は、つながりの読みの手詰まりの回数を超えない。
 */
export function isBridgesSolveWorkload(
  value: unknown,
): value is BridgesSolveWorkload {
  if (!isRecordObject(value)) {
    return false;
  }
  const {
    islandCount,
    edgeCount,
    bridgeCount,
    countRoundCount,
    connectivityRoundCount,
    countReasoningUndecidedEdgeCount,
    lookaheadRoundCount,
  } = value;
  return (
    isPositiveInteger(islandCount) &&
    isNonNegativeInteger(edgeCount) &&
    isNonNegativeInteger(bridgeCount) &&
    isNonNegativeInteger(countRoundCount) &&
    isNonNegativeInteger(connectivityRoundCount) &&
    isNonNegativeInteger(countReasoningUndecidedEdgeCount) &&
    edgeCount >= islandCount - 1 &&
    bridgeCount >= islandCount - 1 &&
    countReasoningUndecidedEdgeCount <= edgeCount &&
    (lookaheadRoundCount === undefined ||
      (isNonNegativeInteger(lookaheadRoundCount) &&
        lookaheadRoundCount <= connectivityRoundCount))
  );
}
