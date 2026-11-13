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

/** 架かった橋でつながった島の組。島の番号の小さい順に組を並べる。 */
function listBridgesIslandGroups(
  board: BridgesBoard,
  state: BridgesPuzzleState,
): number[][] {
  const { edges, islandEdges } = getBridgesNetwork(board);
  const grouped = new Set<number>();
  const groups: number[][] = [];
  for (let start = 0; start < board.islands.length; start += 1) {
    if (grouped.has(start)) {
      continue;
    }
    const group = [start];
    grouped.add(start);
    for (let index = 0; index < group.length; index += 1) {
      const island = group[index]!;
      for (const edgeIndex of islandEdges[island]!) {
        const edge = edges[edgeIndex]!;
        const other = edge.from === island ? edge.to : edge.from;
        if (state.bridges[edgeIndex] !== 0 && !grouped.has(other)) {
          grouped.add(other);
          group.push(other);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

/**
 * 全部の島が数字どおりなのにクリアにならないとき、いちばん大きな組から離れている島。
 * それ以外のとき（数字の合わない島がある、全部つながっている）は空にする。
 * いちばん大きな組が複数あるときは、島の番号の小さい島を含む組を残す。
 */
export function listBridgesIsolatedIslands(
  board: BridgesBoard,
  state: BridgesPuzzleState,
): number[] {
  if (
    !areBridgesPlacementsValid(board, state) ||
    listBridgesIslandStatuses(board, state).some((status) => status !== "exact")
  ) {
    return [];
  }
  const groups = listBridgesIslandGroups(board, state);
  if (groups.length < 2) {
    return [];
  }
  const largest = groups.reduce((current, group) =>
    group.length > current.length ? group : current,
  );
  return groups
    .filter((group) => group !== largest)
    .flat()
    .sort((left, right) => left - right);
}
