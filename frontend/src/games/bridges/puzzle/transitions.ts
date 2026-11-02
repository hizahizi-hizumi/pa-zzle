import {
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import type {
  BridgeCount,
  BridgesPuzzleState,
} from "@/games/bridges/puzzle/state";

/**
 * 辺の橋の本数を変えた結果。
 * - `changed`: 本数を変えた。
 * - `blocked`: 交わる辺に橋があるので架けなかった。`crossingEdges` はその橋のある辺の番号。
 */
export type BridgesEdgeChange =
  | { kind: "changed"; state: BridgesPuzzleState }
  | { kind: "blocked"; crossingEdges: readonly number[] };

const nextBridgeCounts = {
  0: 1,
  1: 2,
  2: 0,
} as const satisfies Record<BridgeCount, BridgeCount>;

/**
 * 辺の橋を 1本 → 2本 → なし の順に回す。タップでも、島から島へなぞったときも同じに回す。
 * 橋の無い辺に架けるとき、交わる辺に橋があれば架けない。
 */
export function cycleBridgesEdge(
  board: BridgesBoard,
  state: BridgesPuzzleState,
  edge: number,
): BridgesEdgeChange {
  const current = state.bridges[edge];
  if (current === undefined) {
    throw new RangeError(`Bridges edge is out of range: ${edge}`);
  }
  if (current === 0) {
    const crossingEdges = getBridgesNetwork(board).crossingEdges[edge]!.filter(
      (crossing) => state.bridges[crossing] !== 0,
    );
    if (crossingEdges.length > 0) {
      return { kind: "blocked", crossingEdges };
    }
  }
  const bridges = state.bridges.with(edge, nextBridgeCounts[current]);
  return { kind: "changed", state: { bridges } };
}
