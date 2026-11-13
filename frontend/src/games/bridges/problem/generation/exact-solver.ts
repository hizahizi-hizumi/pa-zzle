import {
  applyBridgeCrossings,
  areAllBridgeComponentsJoined,
  type BridgeBounds,
  BridgesContradiction,
  type BridgesSolverContext,
  canBridgesStillConnect,
  copyBridgeBounds,
  createBridgesSolverContext,
  createInitialBridgeBounds,
  hasClosedBridgeComponent,
} from "@/games/bridges/problem/generation/bridge-bounds";
import type { BridgesBoard } from "@/games/bridges/puzzle/board";

/**
 * - `limit`: ここまで見つけたら数えるのをやめる解の数。
 * - `ignoresConnectivity`: 全島のつながりを規則から外して数える（つながりを読まないと決まらない問題かを測る）。
 * - `nodeLimit`: 探索する局面の数の上限。人の能力ではなく、計算を打ち切るための上限。
 */
export type BridgesSolutionCountOptions = {
  limit: number;
  ignoresConnectivity?: boolean;
  nodeLimit: number;
};

/**
 * - `solutionCount`: 見つけた解の数（`limit` まで）。
 * - `nodeCount`: 探索した局面の数。研究用の解法器と同じ数になる。
 * - `exceededNodeLimit`: 局面の数が上限を超えて打ち切った。解の数は確かでない。
 * - `firstSolution`: 最初に見つけた解の、辺ごとの橋の本数。
 */
export type BridgesSolutionCount = {
  solutionCount: number;
  nodeCount: number;
  exceededNodeLimit: boolean;
  firstSolution: readonly number[] | null;
};

/** 島ごとに、他の辺を上限まで使っても足りない分と、決まった分を除いた残りで、辺の範囲を締める。動かなくなるまで繰り返す。 */
function propagateExactly(
  context: BridgesSolverContext,
  bounds: BridgeBounds,
  usesConnectivity: boolean,
): void {
  const { network, clues } = context;
  const { lower, upper } = bounds;
  let changed = true;
  while (changed) {
    changed = false;
    applyBridgeCrossings(context, bounds);
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
      // 合計は島の締め始めの値のまま使う。研究用の解法器と同じ局面の数にするため。
      for (const edge of edges) {
        const atLeast = clue - (upperSum - upper[edge]!);
        const atMost = clue - (lowerSum - lower[edge]!);
        if (atLeast > lower[edge]!) {
          lower[edge] = atLeast;
          changed = true;
        }
        if (atMost < upper[edge]!) {
          upper[edge] = atMost;
          changed = true;
        }
        if (lower[edge]! > upper[edge]!) {
          throw new BridgesContradiction();
        }
      }
    }
    if (usesConnectivity && !changed) {
      if (
        hasClosedBridgeComponent(context, lower) ||
        !canBridgesStillConnect(context, upper)
      ) {
        throw new BridgesContradiction();
      }
    }
  }
}

function selectBranchEdge(
  { network, endpoints }: BridgesSolverContext,
  { lower, upper }: BridgeBounds,
): number | null {
  let best: number | null = null;
  let bestWidth = Number.POSITIVE_INFINITY;
  let bestDegree = Number.POSITIVE_INFINITY;
  for (const [edge, [from, to]] of endpoints.entries()) {
    const width = upper[edge]! - lower[edge]!;
    if (width === 0) {
      continue;
    }
    const degree =
      network.islandEdges[from]!.length + network.islandEdges[to]!.length;
    if (width < bestWidth || (width === bestWidth && degree < bestDegree)) {
      best = edge;
      bestWidth = width;
      bestDegree = degree;
    }
  }
  return best;
}

/**
 * 交差・本数・つながりの規則で解を数える。辺ごとの本数の範囲を島の数字と交差で締め、
 * 架けうる辺でつながらない局面・閉じた組のある局面を枝刈りし、範囲の狭い辺から上限の本数の順に分ける。
 */
export function countBridgesSolutions(
  board: BridgesBoard,
  {
    limit,
    ignoresConnectivity = false,
    nodeLimit,
  }: BridgesSolutionCountOptions,
): BridgesSolutionCount {
  const context = createBridgesSolverContext(board);
  const usesConnectivity = !ignoresConnectivity;
  let nodeCount = 0;
  let solutionCount = 0;
  let exceededNodeLimit = false;
  let firstSolution: number[] | null = null;

  function isFinished(): boolean {
    return solutionCount >= limit || exceededNodeLimit;
  }

  function search(bounds: BridgeBounds): void {
    if (isFinished()) {
      return;
    }
    nodeCount += 1;
    if (nodeCount > nodeLimit) {
      exceededNodeLimit = true;
      return;
    }
    try {
      propagateExactly(context, bounds, usesConnectivity);
    } catch (error) {
      if (error instanceof BridgesContradiction) {
        return;
      }
      throw error;
    }
    const edge = selectBranchEdge(context, bounds);
    if (edge === null) {
      if (
        usesConnectivity &&
        !areAllBridgeComponentsJoined(context, bounds.lower)
      ) {
        return;
      }
      solutionCount += 1;
      firstSolution ??= [...bounds.lower];
      return;
    }
    for (
      let count = bounds.upper[edge]!;
      count >= bounds.lower[edge]!;
      count -= 1
    ) {
      const branch = copyBridgeBounds(bounds);
      branch.lower[edge] = count;
      branch.upper[edge] = count;
      search(branch);
      if (isFinished()) {
        return;
      }
    }
  }

  search(createInitialBridgeBounds(context));
  return { solutionCount, nodeCount, exceededNodeLimit, firstSolution };
}
