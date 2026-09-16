import { applyWaterSortMove, listWaterSortLegalMoves } from "./rules";
import {
  countEmptyWaterSortBottles,
  countWaterSortColorBlocks,
  countWaterSortColors,
  createWaterSortStateKey,
  isWaterSortCleared,
  type WaterSortMove,
  type WaterSortState,
} from "./state";

export type WaterSortSearchStatus = "solved" | "unsolvable" | "limit-reached";

export type WaterSortSearchStatistics = {
  expandedStates: number;
  generatedTransitions: number;
  uniqueStates: number;
  maxFrontierSize: number;
};

export type WaterSortProblemFeatures = {
  shortestMoveCount: number;
  initialLegalMoveCount: number;
  initialDistinctChoiceCount: number;
  averageDistinctChoiceCountOnSolution: number;
  maximumDistinctChoiceCountOnSolution: number;
  forcedChoiceRatio: number;
  noEmptyBottleStateRatio: number;
  longestNoEmptyBottleRun: number;
};

export type WaterSortSolveResult = {
  status: WaterSortSearchStatus;
  moves: readonly WaterSortMove[];
  statistics: WaterSortSearchStatistics;
  features: WaterSortProblemFeatures | null;
};

export type WaterSortSolverOptions = {
  maxExpandedStates?: number;
};

type SearchNode = {
  state: WaterSortState;
  stateKey: string;
  cost: number;
  heuristic: number;
  sequence: number;
  parent: SearchNode | null;
  moveFromParent: WaterSortMove | null;
};

type SearchTransition = {
  state: WaterSortState;
  stateKey: string;
  move: WaterSortMove;
};

class SearchQueue {
  private readonly nodes: SearchNode[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(node: SearchNode): void {
    this.nodes.push(node);
    this.bubbleUp(this.nodes.length - 1);
  }

  pop(): SearchNode | undefined {
    const first = this.nodes[0];
    const last = this.nodes.pop();
    if (!first || !last) {
      return first;
    }

    if (this.nodes.length > 0) {
      this.nodes[0] = last;
      this.bubbleDown(0);
    }

    return first;
  }

  private bubbleUp(startIndex: number): void {
    let index = startIndex;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const node = this.nodes[index];
      const parent = this.nodes[parentIndex];
      if (!node || !parent || compareSearchNodes(parent, node) <= 0) {
        break;
      }

      this.nodes[index] = parent;
      this.nodes[parentIndex] = node;
      index = parentIndex;
    }
  }

  private bubbleDown(startIndex: number): void {
    let index = startIndex;
    while (true) {
      const leftIndex = index * 2 + 1;
      const rightIndex = leftIndex + 1;
      let bestIndex = index;

      const left = this.nodes[leftIndex];
      const currentBestAfterLeft = this.nodes[bestIndex];
      if (
        left &&
        currentBestAfterLeft &&
        compareSearchNodes(left, currentBestAfterLeft) < 0
      ) {
        bestIndex = leftIndex;
      }

      const right = this.nodes[rightIndex];
      const currentBestAfterRight = this.nodes[bestIndex];
      if (
        right &&
        currentBestAfterRight &&
        compareSearchNodes(right, currentBestAfterRight) < 0
      ) {
        bestIndex = rightIndex;
      }
      if (bestIndex === index) {
        break;
      }

      const node = this.nodes[index];
      const best = this.nodes[bestIndex];
      if (!node || !best) {
        break;
      }
      this.nodes[index] = best;
      this.nodes[bestIndex] = node;
      index = bestIndex;
    }
  }
}

function compareSearchNodes(left: SearchNode, right: SearchNode): number {
  const leftScore = left.cost + left.heuristic;
  const rightScore = right.cost + right.heuristic;

  return (
    leftScore - rightScore ||
    left.heuristic - right.heuristic ||
    left.sequence - right.sequence
  );
}

function estimateRemainingMoves(state: WaterSortState): number {
  return Math.max(
    0,
    countWaterSortColorBlocks(state) - countWaterSortColors(state),
  );
}

function listDistinctSearchTransitions(
  state: WaterSortState,
): SearchTransition[] {
  const currentStateKey = createWaterSortStateKey(state);
  const seenStateKeys = new Set<string>();
  const transitions: SearchTransition[] = [];

  for (const move of listWaterSortLegalMoves(state)) {
    const nextState = applyWaterSortMove(state, move);
    if (!nextState) {
      continue;
    }

    const stateKey = createWaterSortStateKey(nextState);
    if (stateKey === currentStateKey || seenStateKeys.has(stateKey)) {
      continue;
    }

    seenStateKeys.add(stateKey);
    transitions.push({ state: nextState, stateKey, move });
  }

  return transitions;
}

function reconstructPath(goal: SearchNode): SearchNode[] {
  const reversedPath: SearchNode[] = [];
  let node: SearchNode | null = goal;

  while (node) {
    reversedPath.push(node);
    node = node.parent;
  }

  return reversedPath.reverse();
}

function calculateProblemFeatures(
  path: readonly SearchNode[],
): WaterSortProblemFeatures {
  const initialState = path[0]?.state ?? [];
  const playableStates = path.slice(0, -1);
  const distinctChoiceCounts = playableStates.map(
    ({ state }) => listDistinctSearchTransitions(state).length,
  );
  const noEmptyBottleFlags = playableStates.map(
    ({ state }) => countEmptyWaterSortBottles(state) === 0,
  );

  let longestNoEmptyBottleRun = 0;
  let currentNoEmptyBottleRun = 0;
  for (const hasNoEmptyBottle of noEmptyBottleFlags) {
    if (hasNoEmptyBottle) {
      currentNoEmptyBottleRun += 1;
      longestNoEmptyBottleRun = Math.max(
        longestNoEmptyBottleRun,
        currentNoEmptyBottleRun,
      );
    } else {
      currentNoEmptyBottleRun = 0;
    }
  }

  const moveCount = Math.max(0, path.length - 1);
  const totalDistinctChoices = distinctChoiceCounts.reduce(
    (sum, count) => sum + count,
    0,
  );
  const forcedChoiceCount = distinctChoiceCounts.filter(
    (count) => count === 1,
  ).length;
  const noEmptyBottleStateCount = noEmptyBottleFlags.filter(Boolean).length;

  return {
    shortestMoveCount: moveCount,
    initialLegalMoveCount: listWaterSortLegalMoves(initialState).length,
    initialDistinctChoiceCount: distinctChoiceCounts[0] ?? 0,
    averageDistinctChoiceCountOnSolution:
      moveCount === 0 ? 0 : totalDistinctChoices / moveCount,
    maximumDistinctChoiceCountOnSolution:
      distinctChoiceCounts.length === 0
        ? 0
        : Math.max(...distinctChoiceCounts),
    forcedChoiceRatio: moveCount === 0 ? 0 : forcedChoiceCount / moveCount,
    noEmptyBottleStateRatio:
      moveCount === 0 ? 0 : noEmptyBottleStateCount / moveCount,
    longestNoEmptyBottleRun,
  };
}

export function solveWaterSort(
  initialState: WaterSortState,
  options: WaterSortSolverOptions = {},
): WaterSortSolveResult {
  const maxExpandedStates =
    options.maxExpandedStates ?? Number.POSITIVE_INFINITY;
  if (
    maxExpandedStates !== Number.POSITIVE_INFINITY &&
    (!Number.isInteger(maxExpandedStates) || maxExpandedStates < 0)
  ) {
    throw new RangeError(
      "maxExpandedStates must be a non-negative integer or Infinity",
    );
  }

  const initialStateKey = createWaterSortStateKey(initialState);
  const initialNode: SearchNode = {
    state: initialState.map((bottle) => [...bottle]),
    stateKey: initialStateKey,
    cost: 0,
    heuristic: estimateRemainingMoves(initialState),
    sequence: 0,
    parent: null,
    moveFromParent: null,
  };
  const queue = new SearchQueue();
  queue.push(initialNode);

  const bestCostByState = new Map([[initialStateKey, 0]]);
  let expandedStates = 0;
  let generatedTransitions = 0;
  let maxFrontierSize = 1;
  let sequence = 1;

  while (queue.size > 0) {
    const current = queue.pop();
    if (!current) {
      break;
    }

    if (current.cost !== bestCostByState.get(current.stateKey)) {
      continue;
    }

    if (isWaterSortCleared(current.state)) {
      const path = reconstructPath(current);
      const moves = path
        .slice(1)
        .map((node) => node.moveFromParent)
        .filter((move): move is WaterSortMove => move !== null);

      return {
        status: "solved",
        moves,
        statistics: {
          expandedStates,
          generatedTransitions,
          uniqueStates: bestCostByState.size,
          maxFrontierSize,
        },
        features: calculateProblemFeatures(path),
      };
    }

    if (expandedStates >= maxExpandedStates) {
      return {
        status: "limit-reached",
        moves: [],
        statistics: {
          expandedStates,
          generatedTransitions,
          uniqueStates: bestCostByState.size,
          maxFrontierSize,
        },
        features: null,
      };
    }

    expandedStates += 1;
    const transitions = listDistinctSearchTransitions(current.state);
    generatedTransitions += transitions.length;

    for (const transition of transitions) {
      const nextCost = current.cost + 1;
      const bestKnownCost = bestCostByState.get(transition.stateKey);
      if (bestKnownCost !== undefined && bestKnownCost <= nextCost) {
        continue;
      }

      bestCostByState.set(transition.stateKey, nextCost);
      queue.push({
        state: transition.state,
        stateKey: transition.stateKey,
        cost: nextCost,
        heuristic: estimateRemainingMoves(transition.state),
        sequence,
        parent: current,
        moveFromParent: transition.move,
      });
      sequence += 1;
    }

    maxFrontierSize = Math.max(maxFrontierSize, queue.size);
  }

  return {
    status: "unsolvable",
    moves: [],
    statistics: {
      expandedStates,
      generatedTransitions,
      uniqueStates: bestCostByState.size,
      maxFrontierSize,
    },
    features: null,
  };
}
