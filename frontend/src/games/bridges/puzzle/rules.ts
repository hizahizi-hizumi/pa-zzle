import {
  BRIDGES_MAXIMUM_BRIDGE_COUNT,
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import type { BridgesPuzzleState } from "@/games/bridges/puzzle/state";

/**
 * 島から出ている橋の本数と、島の数字の比べ。
 * - `short`: 数字より少ない。
 * - `exact`: 数字と同じ。
 * - `over`: 数字より多い。
 */
export type BridgesIslandStatus = "short" | "exact" | "over";

/** 島ごとの、出ている橋の本数。 */
export function countBridgesIslandBridges(
  board: BridgesBoard,
  state: BridgesPuzzleState,
): number[] {
  const { islandEdges } = getBridgesNetwork(board);
  return islandEdges.map((edges) =>
    edges.reduce((total, edge) => total + state.bridges[edge]!, 0),
  );
}

/** 島ごとの、橋の本数と数字の比べ。 */
export function listBridgesIslandStatuses(
  board: BridgesBoard,
  state: BridgesPuzzleState,
): BridgesIslandStatus[] {
  return countBridgesIslandBridges(board, state).map(
    function compareWithClue(count, island) {
      const { clue } = board.islands[island]!;
      if (count < clue) return "short";
      return count === clue ? "exact" : "over";
    },
  );
}

/** 橋でたどって、全部の島が1つにつながっているか。 */
export function areBridgesIslandsConnected(
  board: BridgesBoard,
  state: BridgesPuzzleState,
): boolean {
  const { edges, islandEdges } = getBridgesNetwork(board);
  const reached = new Set([0]);
  const pending = [0];
  for (
    let island = pending.pop();
    island !== undefined;
    island = pending.pop()
  ) {
    for (const edgeIndex of islandEdges[island]!) {
      const edge = edges[edgeIndex]!;
      const other = edge.from === island ? edge.to : edge.from;
      if (state.bridges[edgeIndex] !== 0 && !reached.has(other)) {
        reached.add(other);
        pending.push(other);
      }
    }
  }
  return reached.size === board.islands.length;
}

/** 橋の本数がどの辺でも 0〜2 で、交わる2辺の両方に橋が無いか。 */
function areBridgesPlacementsValid(
  board: BridgesBoard,
  state: BridgesPuzzleState,
): boolean {
  const { edges, crossingEdges } = getBridgesNetwork(board);
  return (
    state.bridges.length === edges.length &&
    state.bridges.every(
      (count, edge) =>
        Number.isInteger(count) &&
        count >= 0 &&
        count <= BRIDGES_MAXIMUM_BRIDGE_COUNT &&
        (count === 0 ||
          crossingEdges[edge]!.every(
            (crossing) => state.bridges[crossing] === 0,
          )),
    )
  );
}

/**
 * 橋が規則を満たして完成したか。橋を架けた入力処理を信頼せず、規則だけで確かめる。
 * 交わる橋が無く、どの島も数字と同じ本数で、全部の島が1つにつながっていること。
 * 問題は一意解なので、保存した解との一致は要らない。
 */
export function isBridgesSolved(
  board: BridgesBoard,
  state: BridgesPuzzleState,
): boolean {
  return (
    areBridgesPlacementsValid(board, state) &&
    listBridgesIslandStatuses(board, state).every(
      (status) => status === "exact",
    ) &&
    areBridgesIslandsConnected(board, state)
  );
}
