import {
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import type {
  BridgeCount,
  BridgesPuzzleState,
} from "@/games/bridges/puzzle/state";

export type BridgesEdgeChange =
  | { kind: "changed"; state: BridgesPuzzleState }
  // 交わる辺に橋があるので架けなかった。`crossingEdges` はその橋のある辺の番号。
  | { kind: "blocked"; crossingEdges: readonly number[] };

export type BridgesCycleDirection = "forward" | "backward";

const nextBridgeCounts = {
  forward: { 0: 1, 1: 2, 2: 0 },
  backward: { 0: 2, 1: 0, 2: 1 },
} as const satisfies Record<
  BridgesCycleDirection,
  Record<BridgeCount, BridgeCount>
>;

export function cycleBridgesEdge(
  board: BridgesBoard,
  state: BridgesPuzzleState,
  edge: number,
  direction: BridgesCycleDirection = "forward",
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
  const bridges = state.bridges.with(
    edge,
    nextBridgeCounts[direction][current],
  );
  return { kind: "changed", state: { bridges } };
}
