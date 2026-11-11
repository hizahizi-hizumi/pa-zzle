import {
  BRIDGES_MAXIMUM_BRIDGE_COUNT,
  type BridgesBoard,
  type BridgesNetwork,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";

/**
 * 解法器が辺ごとに持つ、橋の本数の範囲。`lower[e]`〜`upper[e]` 本のどれかが架かる。
 * 解法器は範囲を狭めていき、全辺で `lower` と `upper` が等しくなれば橋が決まる。
 */
export type BridgeBounds = {
  lower: number[];
  upper: number[];
};

/** 範囲が成り立たなくなった（本数・交差・つながりの規則が破れた）ことを知らせる。 */
export class BridgesContradiction extends Error {
  constructor() {
    super("Bridges bounds are contradictory");
  }
}

/** 解法器が使う盤面の事実。 */
export type BridgesSolverContext = {
  board: BridgesBoard;
  network: BridgesNetwork;
  /** 辺ごとの両端の島。 */
  endpoints: readonly (readonly [number, number])[];
  clues: readonly number[];
};

export function createBridgesSolverContext(
  board: BridgesBoard,
): BridgesSolverContext {
  const network = getBridgesNetwork(board);
  return {
    board,
    network,
    endpoints: network.edges.map(({ from, to }) => [from, to] as const),
    clues: board.islands.map(({ clue }) => clue),
  };
}

/** 何も決まっていない範囲。上限は2本と両端の島の数字の小さい方。 */
export function createInitialBridgeBounds({
  endpoints,
  clues,
}: BridgesSolverContext): BridgeBounds {
  return {
    lower: endpoints.map(() => 0),
    upper: endpoints.map(([from, to]) =>
      Math.min(BRIDGES_MAXIMUM_BRIDGE_COUNT, clues[from]!, clues[to]!),
    ),
  };
}

export function copyBridgeBounds({ lower, upper }: BridgeBounds): BridgeBounds {
  return { lower: [...lower], upper: [...upper] };
}

export function isEveryEdgeDecided({ lower, upper }: BridgeBounds): boolean {
  return lower.every((value, edge) => value === upper[edge]);
}

/** 架かることが決まった橋と交わる辺を0本にする。交わる2辺の両方に架かると決まっていれば矛盾。 */
export function applyBridgeCrossings(
  { network }: BridgesSolverContext,
  { lower, upper }: BridgeBounds,
): void {
  for (const [edge, crossings] of network.crossingEdges.entries()) {
    if (lower[edge]! === 0) {
      continue;
    }
    for (const crossing of crossings) {
      if (lower[crossing]! > 0) {
        throw new BridgesContradiction();
      }
      upper[crossing] = 0;
    }
  }
}

/** どの島でも、決まった本数が数字を超えず、架けうる本数が数字に届くこと。範囲が空の辺が無いこと。 */
export function checkBridgeCounts(
  { network, clues }: BridgesSolverContext,
  { lower, upper }: BridgeBounds,
): void {
  for (const [island, edges] of network.islandEdges.entries()) {
    const clue = clues[island]!;
    let lowerSum = 0;
    let upperSum = 0;
    for (const edge of edges) {
      lowerSum += lower[edge]!;
      upperSum += upper[edge]!;
    }
    if (lowerSum > clue || upperSum < clue) {
      throw new BridgesContradiction();
    }
  }
  if (lower.some((value, edge) => value > upper[edge]!)) {
    throw new BridgesContradiction();
  }
}

/** 島ごとの、架かると決まった橋でつながった組の代表の島。 */
export function findBridgeComponents(
  { board, endpoints }: BridgesSolverContext,
  lower: readonly number[],
): number[] {
  const parent = board.islands.map((_, island) => island);
  function find(island: number): number {
    let root = island;
    while (parent[root] !== root) {
      parent[root] = parent[parent[root]!]!;
      root = parent[root]!;
    }
    return root;
  }
  for (const [edge, [from, to]] of endpoints.entries()) {
    if (lower[edge]! > 0) {
      const fromRoot = find(from);
      const toRoot = find(to);
      if (fromRoot !== toRoot) {
        parent[fromRoot] = toRoot;
      }
    }
  }
  return board.islands.map((_, island) => find(island));
}

export function areAllBridgeComponentsJoined(
  context: BridgesSolverContext,
  lower: readonly number[],
): boolean {
  return new Set(findBridgeComponents(context, lower)).size === 1;
}

/** 架けうる辺（上限が1以上）だけで全島がつながりうるか。`skippedEdge` の辺は無いものとする。 */
export function canBridgesStillConnect(
  { board, network, endpoints }: BridgesSolverContext,
  upper: readonly number[],
  skippedEdge = -1,
): boolean {
  const reached = new Set([0]);
  const pending = [0];
  for (
    let island = pending.pop();
    island !== undefined;
    island = pending.pop()
  ) {
    for (const edge of network.islandEdges[island]!) {
      if (edge === skippedEdge || upper[edge] === 0) {
        continue;
      }
      const [from, to] = endpoints[edge]!;
      const other = from === island ? to : from;
      if (!reached.has(other)) {
        reached.add(other);
        pending.push(other);
      }
    }
  }
  return reached.size === board.islands.length;
}

/** 架かると決まった橋でできた組のうち、全島ではないのに組の全員の本数が足りて閉じた組があるか。 */
export function hasClosedBridgeComponent(
  context: BridgesSolverContext,
  lower: readonly number[],
): boolean {
  const { network, clues } = context;
  const components = findBridgeComponents(context, lower);
  const sizes = new Map<number, number>();
  const remaining = new Map<number, number>();
  for (const [island, root] of components.entries()) {
    sizes.set(root, (sizes.get(root) ?? 0) + 1);
    const placed = network.islandEdges[island]!.reduce(
      (total, edge) => total + lower[edge]!,
      0,
    );
    remaining.set(root, (remaining.get(root) ?? 0) + clues[island]! - placed);
  }
  return [...sizes].some(
    ([root, size]) => size < components.length && remaining.get(root) === 0,
  );
}
