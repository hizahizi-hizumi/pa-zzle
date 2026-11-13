import {
  BRIDGES_MAXIMUM_BRIDGE_COUNT,
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import type { BridgesPuzzleState } from "@/games/bridges/puzzle/state";

export type BridgesIslandStatus = "short" | "exact" | "over";

export function countBridgesIslandBridges(
  board: BridgesBoard,
  state: BridgesPuzzleState,
): number[] {
  const { islandEdges } = getBridgesNetwork(board);
  return islandEdges.map((edges) =>
    edges.reduce((total, edge) => total + state.bridges[edge]!, 0),
  );
}

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

export function listBridgesIslandGroups(
  board: BridgesBoard,
  state: BridgesPuzzleState,
): number[][] {
  const { edges, islandEdges } = getBridgesNetwork(board);
  const grouped = new Set<number>();
  const groups: number[][] = [];
  for (const [start] of board.islands.entries()) {
    if (grouped.has(start)) {
      continue;
    }
    const group = [start];
    grouped.add(start);
    for (let index = 0; index < group.length; index += 1) {
      const island = group[index]!;
      for (const edgeIndex of islandEdges[island]!) {
        const { from, to } = edges[edgeIndex]!;
        const other = from === island ? to : from;
        if (state.bridges[edgeIndex] !== 0 && !grouped.has(other)) {
          grouped.add(other);
          group.push(other);
        }
      }
    }
    groups.push(group.sort((left, right) => left - right));
  }
  return groups;
}

export function areBridgesIslandsConnected(
  board: BridgesBoard,
  state: BridgesPuzzleState,
): boolean {
  return listBridgesIslandGroups(board, state).length <= 1;
}

/**
 * どの島も数字とちょうどなのに、全部の島が1つにつながっていない盤面の、島の組（`listBridgesIslandGroups`）の数。
 * そうでない盤面では `null`。
 */
export function countBridgesSeparatedIslandGroups(
  board: BridgesBoard,
  state: BridgesPuzzleState,
  islandStatuses: readonly BridgesIslandStatus[],
): number | null {
  if (!islandStatuses.every((status) => status === "exact")) {
    return null;
  }
  const groupCount = listBridgesIslandGroups(board, state).length;
  return groupCount > 1 ? groupCount : null;
}

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
 * 橋を架けた入力処理を信頼せず、規則だけで確かめる。
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
