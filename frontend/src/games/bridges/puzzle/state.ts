import {
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";

/** 1つの辺に架けた橋の本数。 */
export type BridgeCount = 0 | 1 | 2;

/** 架けた橋。`bridges` は辺の番号（`getBridgesNetwork` の `edges` の位置）ごとの橋の本数。 */
export type BridgesPuzzleState = {
  bridges: readonly BridgeCount[];
};

/** 橋が1本も無い状態。 */
export function createInitialBridgesState(
  board: BridgesBoard,
): BridgesPuzzleState {
  return { bridges: getBridgesNetwork(board).edges.map(() => 0) };
}
