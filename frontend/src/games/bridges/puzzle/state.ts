import {
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";

export type BridgeCount = 0 | 1 | 2;

export type BridgesPuzzleState = {
  /** 辺の番号（`getBridgesNetwork` の `edges` の位置）ごとの橋の本数。 */
  bridges: readonly BridgeCount[];
};

export function createInitialBridgesState(
  board: BridgesBoard,
): BridgesPuzzleState {
  return { bridges: getBridgesNetwork(board).edges.map(() => 0) };
}
