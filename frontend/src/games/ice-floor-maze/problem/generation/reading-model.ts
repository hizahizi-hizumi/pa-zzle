import {
  DIRECTION_COUNT,
  measureDistancesToGoal,
  type StateSpace,
} from "@/games/ice-floor-maze/problem/generation/state-space";

/**
 * 先を読む人のモデル（研究用 v2 の `lookahead_solves`、v3 の `dynamic_depth`）。
 * 今の位置から `depth` 手以内に目標があれば解け、無ければ各手の後 `depth − 1` 手以内で最もよい位置で手を比べて進む。
 * 戻らない・待ったを使わない。
 */

/** 向きつきの辺を持つグラフ。ノード `node` の辺は `offsets[node]` から `offsets[node + 1]` の手前まで。 */
export type ReadingGraph = {
  nodeCount: number;
  offsets: Int32Array;
  directions: Int32Array;
  ends: Int32Array;
};

/** 同点の手を比べる順位（向きごとの順位）。研究用の `TIE_ORDERS`。 */
export const TIE_ORDERS = [
  [0, 1, 2, 3],
  [3, 2, 1, 0],
  [1, 3, 0, 2],
  [2, 0, 3, 1],
] as const;

export function createReadingGraph(
  nodeCount: number,
  edges: readonly (readonly [from: number, direction: number, end: number])[],
): ReadingGraph {
  const offsets = new Int32Array(nodeCount + 1);
  for (const [from] of edges) {
    offsets[from + 1]! += 1;
  }
  for (let node = 0; node < nodeCount; node += 1) {
    offsets[node + 1]! += offsets[node]!;
  }
  const filled = offsets.slice(0, nodeCount);
  const directions = new Int32Array(edges.length);
  const ends = new Int32Array(edges.length);
  for (const [from, direction, end] of edges) {
    const slot = filled[from]!;
    directions[slot] = direction;
    ends[slot] = end;
    filled[from] = slot + 1;
  }
  return { nodeCount, offsets, directions, ends };
}

/** 状態のグラフを、状態を番号にした読みのグラフにする。 */
function createStateReadingGraph(space: StateSpace): ReadingGraph {
  const edges: [number, number, number][] = [];
  for (let state = 0; state < space.count; state += 1) {
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const target = space.targets[state * DIRECTION_COUNT + direction]!;
      if (target >= 0) {
        edges.push([state, direction, target]);
      }
    }
  }
  return createReadingGraph(space.count, edges);
}

/** ノードから `radius` 手以内のノード。同じグラフで何度も求めるので覚えておく。 */
export type BallCache = {
  graph: ReadingGraph;
  balls: Map<number, Int32Array>;
};

export function createBallCache(graph: ReadingGraph): BallCache {
  return { graph, balls: new Map() };
}

const MAXIMUM_RADIUS = 64;

function getBall(cache: BallCache, node: number, radius: number): Int32Array {
  const key = node * MAXIMUM_RADIUS + radius;
  const found = cache.balls.get(key);
  if (found) {
    return found;
  }
  const { offsets, ends } = cache.graph;
  const members = [node];
  const seen = new Set([node]);
  let frontierStart = 0;
  for (let step = 0; step < radius; step += 1) {
    const frontierEnd = members.length;
    for (let index = frontierStart; index < frontierEnd; index += 1) {
      const from = members[index]!;
      for (let edge = offsets[from]!; edge < offsets[from + 1]!; edge += 1) {
        const end = ends[edge]!;
        if (!seen.has(end)) {
          seen.add(end);
          members.push(end);
        }
      }
    }
    frontierStart = frontierEnd;
  }
  const ball = Int32Array.from(members);
  cache.balls.set(key, ball);
  return ball;
}

/**
 * `origin` から読みのモデルで進み、`limit` 手までに `depth` 手先の目標（`targets[node] === 1`）が見えれば真。
 * `score` は小さいほどよい位置。
 */
export function lookaheadSolves(
  cache: BallCache,
  origin: number,
  targets: Uint8Array,
  score: (node: number) => number,
  depth: number,
  limit: number,
  tieOrder: readonly number[],
): boolean {
  const { offsets, directions, ends, nodeCount } = cache.graph;
  const scores = new Float64Array(nodeCount).fill(Number.NaN);
  function scoreOf(node: number): number {
    let value = scores[node]!;
    if (Number.isNaN(value)) {
      value = score(node);
      scores[node] = value;
    }
    return value;
  }
  const visited = new Uint8Array(nodeCount);
  let state = origin;
  visited[origin] = 1;
  for (let move = 0; move < limit; move += 1) {
    if (getBall(cache, state, depth).some((node) => targets[node] === 1)) {
      return true;
    }
    let bestEnd = -1;
    let bestWithin = 0;
    let bestScore = 0;
    let bestTie = 0;
    for (let edge = offsets[state]!; edge < offsets[state + 1]!; edge += 1) {
      const end = ends[edge]!;
      if (visited[end] === 1) {
        continue;
      }
      let within = Number.POSITIVE_INFINITY;
      for (const node of getBall(cache, end, depth - 1)) {
        within = Math.min(within, scoreOf(node));
      }
      const endScore = scoreOf(end);
      const tie = tieOrder[directions[edge]!]!;
      if (
        bestEnd < 0 ||
        within < bestWithin ||
        (within === bestWithin &&
          (endScore < bestScore || (endScore === bestScore && tie < bestTie)))
      ) {
        bestEnd = end;
        bestWithin = within;
        bestScore = endScore;
        bestTie = tie;
      }
    }
    if (bestEnd < 0) {
      return false;
    }
    state = bestEnd;
    visited[state] = 1;
  }
  return false;
}

/** 読みで解けたとみなす手数の上限。最短の1.5倍＋2まで（研究用の `tight_give_up`）。 */
export function getReadingMoveLimit(shortest: number): number {
  return shortest + Math.floor((shortest + 1) / 2) + 2;
}

/**
 * 規則を知って先を読む人が、状態のグラフで解ける最小の読み手数（研究用 v3 の `dynamic_depth`）。
 * ゴールへ近づく前向きの読みと、ゴールから `depth` 手以内の状態を目指す読みの小さい方。
 * `maximumDepth` でも読めなければ `maximumDepth + 1`。`space` はゴールつきの状態のグラフ。
 */
export function measureStateReadingDepth(
  space: StateSpace,
  maximumDepth: number,
  toGoal: Int32Array = measureDistancesToGoal(space),
): number {
  const { width } = space.rules;
  const { goal, positions, count } = space;
  const shortest = toGoal[0]!;
  const limit = getReadingMoveLimit(shortest);
  const goalX = goal % width;
  const goalY = Math.floor(goal / width);
  const goalStates = new Uint8Array(count);
  for (let state = 0; state < count; state += 1) {
    if (positions[state] === goal) {
      goalStates[state] = 1;
    }
  }
  function gapToGoal(state: number): number {
    const position = positions[state]!;
    return (
      Math.abs((position % width) - goalX) +
      Math.abs(Math.floor(position / width) - goalY)
    );
  }
  const cache = createBallCache(createStateReadingGraph(space));

  for (let depth = 1; depth <= maximumDepth; depth += 1) {
    const members = new Uint8Array(count);
    const spots = new Set<number>();
    for (let state = 0; state < count; state += 1) {
      if (toGoal[state]! >= 0 && toGoal[state]! <= depth) {
        members[state] = 1;
        spots.add(positions[state]!);
      }
    }
    const spotList = [...spots];
    function gapToMembers(state: number): number {
      const position = positions[state]!;
      const x = position % width;
      const y = Math.floor(position / width);
      let minimum = Number.POSITIVE_INFINITY;
      for (const spot of spotList) {
        minimum = Math.min(
          minimum,
          Math.abs(x - (spot % width)) + Math.abs(y - Math.floor(spot / width)),
        );
      }
      return minimum;
    }
    const attempts = [
      [goalStates, gapToGoal],
      [members, gapToMembers],
    ] as const;
    for (const [targets, score] of attempts) {
      for (const order of TIE_ORDERS) {
        if (lookaheadSolves(cache, 0, targets, score, depth, limit, order)) {
          return depth;
        }
      }
    }
  }
  return maximumDepth + 1;
}
