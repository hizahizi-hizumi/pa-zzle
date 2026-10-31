import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import { getIceFloorMazeCellPosition } from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeStopGraph } from "@/games/ice-floor-maze/puzzle/stop-graph";

/**
 * 先読みのプレイヤーが、読める範囲の止まり先のよさを比べる素朴な方針。
 * - `approach`: ゴールとのマンハッタン距離が小さいほどよい。
 * - `align`: ゴールと同じ行・列にいて間に岩が無い位置を優先し、次に距離が小さいほどよい。
 */
export type IceFloorMazePlanningStrategy = "approach" | "align";

export const iceFloorMazePlanningStrategies = [
  "approach",
  "align",
] as const satisfies readonly IceFloorMazePlanningStrategy[];

/**
 * 同点の手をどの向きから選ぶかの順位（上・右・下・左の順に、その向きの順位）。
 * 1通りに固定すると探索順だけで計画深さが2段以上変わる問題が出るので、4通りを試して最もよい結果をとる。
 */
const directionRankOrders = [
  [0, 1, 2, 3],
  [3, 2, 1, 0],
  [1, 3, 0, 2],
  [2, 0, 3, 1],
] as const satisfies readonly (readonly [number, number, number, number])[];

type DirectionRanks = (typeof directionRankOrders)[number];

/** 停止点から1回の滑りで移れる停止点。`directionIndex` は上・右・下・左の順の番号。 */
type StopMove = { directionIndex: number; to: number };

/** 先読みのたびに引く停止点の移動と、起点から一定の手数以内に行ける停止点の写し。 */
type StopNetwork = {
  origin: number;
  movesByStop: ReadonlyMap<number, readonly StopMove[]>;
  horizons: Map<number, ReadonlyMap<number, number>>;
};

const networksByGraph = new WeakMap<IceFloorMazeStopGraph, StopNetwork>();

function getStopNetwork(graph: IceFloorMazeStopGraph): StopNetwork {
  const cached = networksByGraph.get(graph);
  if (cached) {
    return cached;
  }

  const movesByStop = new Map(
    graph.stops.map((stop) => [
      stop,
      (graph.slides.get(stop) ?? []).flatMap((slide, directionIndex) =>
        slide.status === "slid" ? [{ directionIndex, to: slide.to }] : [],
      ),
    ]),
  );
  const network = { origin: graph.origin, movesByStop, horizons: new Map() };
  networksByGraph.set(graph, network);
  return network;
}

/** 先読みの手数の上限より大きい値。起点と手数の組を1つの数のキーにする。 */
const horizonDepthSlots = 16;

/** `origin` から `depth` 手以内に止まれる停止点と、そこまでの最少手数。 */
function readHorizon(
  network: StopNetwork,
  origin: number,
  depth: number,
): ReadonlyMap<number, number> {
  const key = origin * horizonDepthSlots + depth;
  const cached = network.horizons.get(key);
  if (cached) {
    return cached;
  }

  const moveCounts = new Map([[origin, 0]]);
  const pending = [origin];
  for (let order = 0; order < pending.length; order += 1) {
    const stop = pending[order]!;
    const moveCount = moveCounts.get(stop)!;
    if (moveCount === depth) {
      continue;
    }
    for (const { to } of network.movesByStop.get(stop) ?? []) {
      if (!moveCounts.has(to)) {
        moveCounts.set(to, moveCount + 1);
        pending.push(to);
      }
    }
  }
  network.horizons.set(key, moveCounts);
  return moveCounts;
}

function measureManhattanDistance(
  board: IceFloorMazeBoard,
  from: number,
  to: number,
): number {
  const a = getIceFloorMazeCellPosition(board, from);
  const b = getIceFloorMazeCellPosition(board, to);
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** 同じ行・列にいて、間に岩が無いか。 */
function seesAlongLine(
  board: IceFloorMazeBoard,
  from: number,
  to: number,
): boolean {
  const a = getIceFloorMazeCellPosition(board, from);
  const b = getIceFloorMazeCellPosition(board, to);
  if (a.x !== b.x && a.y !== b.y) {
    return false;
  }

  const step =
    a.x === b.x ? Math.sign(b.y - a.y) * board.width : Math.sign(b.x - a.x);
  for (let cell = from + step; cell !== to; cell += step) {
    if (board.cells[cell] === "rock") {
      return false;
    }
  }
  return true;
}

/** 止まり先の評価値。小さいほどよい。 */
type StopEvaluation = (stop: number) => number;

function createStopEvaluation(
  board: IceFloorMazeBoard,
  goal: number,
  strategy: IceFloorMazePlanningStrategy,
): StopEvaluation {
  switch (strategy) {
    case "approach":
      return function evaluateApproach(stop) {
        return measureManhattanDistance(board, stop, goal);
      };
    case "align": {
      // どの距離よりも大きいので、揃っているかを距離より先に比べる。
      const misalignmentPenalty = board.width + board.height;
      return function evaluateAlignment(stop) {
        return (
          (seesAlongLine(board, stop, goal) ? 0 : misalignmentPenalty) +
          measureManhattanDistance(board, stop, goal)
        );
      };
    }
  }
}

/** 手のよさ。各値が小さいほどよく、前の値から比べる。 */
type MoveRating = readonly [
  bestReachable: number,
  stoppedAt: number,
  directionRank: number,
];

function isBetterRating(rating: MoveRating, best: MoveRating | null): boolean {
  if (best === null) {
    return true;
  }
  for (const [index, value] of rating.entries()) {
    if (value !== best[index]) {
      return value < best[index]!;
    }
  }
  return false;
}

type LookaheadPlay = {
  goal: number;
  depth: number;
  evaluate: StopEvaluation;
  directionRanks: DirectionRanks;
  moveLimit: number;
};

/**
 * `depth` 手先までを読み、ゴールが見えればそこへ向かう。見えなければ、各手の後 `depth − 1` 手以内に行ける
 * 停止点のうち最もよいものを比べて手を選ぶ。一度止まった停止点へは戻らず、待ったは使わない。
 */
function solvesByLookahead(
  network: StopNetwork,
  { goal, depth, evaluate, directionRanks, moveLimit }: LookaheadPlay,
): boolean {
  let stop = network.origin;
  const visited = new Set([stop]);
  for (let moveCount = 0; moveCount < moveLimit; moveCount += 1) {
    if (readHorizon(network, stop, depth).has(goal)) {
      return true;
    }

    let bestRating: MoveRating | null = null;
    let bestStop: number | null = null;
    for (const { directionIndex, to } of network.movesByStop.get(stop) ?? []) {
      if (visited.has(to)) {
        continue;
      }
      let bestReachable = Number.POSITIVE_INFINITY;
      for (const reachable of readHorizon(network, to, depth - 1).keys()) {
        bestReachable = Math.min(bestReachable, evaluate(reachable));
      }
      const rating: MoveRating = [
        bestReachable,
        evaluate(to),
        directionRanks[directionIndex]!,
      ];
      if (isBetterRating(rating, bestRating)) {
        bestRating = rating;
        bestStop = to;
      }
    }
    if (bestStop === null) {
      return false;
    }
    stop = bestStop;
    visited.add(stop);
  }
  return false;
}

/**
 * 先読みのプレイヤーの条件。
 * - `maximumDepth`: 読む手数の上限。
 * - `moveLimit`: プレイヤーが諦めるまでの手数。
 */
export type IceFloorMazePlanningLimits = {
  maximumDepth: number;
  moveLimit: number;
};

/**
 * その方針の先読みのプレイヤーがゴールで止まれる最小の読み手数。同点の向きの順位4通りのうち最も小さい値。
 * 上限まで読んでも止まれなければ `null`。
 */
export function findIceFloorMazePlanningDepth(
  board: IceFloorMazeBoard,
  graph: IceFloorMazeStopGraph,
  goal: number,
  strategy: IceFloorMazePlanningStrategy,
  { maximumDepth, moveLimit }: IceFloorMazePlanningLimits,
): number | null {
  const network = getStopNetwork(graph);
  const evaluate = createStopEvaluation(board, goal, strategy);
  for (let depth = 1; depth <= maximumDepth; depth += 1) {
    const solved = directionRankOrders.some((directionRanks) =>
      solvesByLookahead(network, {
        goal,
        depth,
        evaluate,
        directionRanks,
        moveLimit,
      }),
    );
    if (solved) {
      return depth;
    }
  }
  return null;
}

/**
 * 1手読みでゴールへ近づく順に試し、行けるまだ止まっていない停止点が無くなったら待ったで1つ戻る試行錯誤の手数。
 * 待ったで戻る操作も1手に数える。
 */
function countTrialMoves(
  board: IceFloorMazeBoard,
  network: StopNetwork,
  goal: number,
  directionRanks: DirectionRanks,
): number {
  const visited = new Set([network.origin]);
  const route = [network.origin];
  let moveCount = 0;
  while (route.length > 0) {
    const stop = route.at(-1)!;
    if (stop === goal) {
      return moveCount;
    }

    let bestRating: MoveRating | null = null;
    let bestStop: number | null = null;
    for (const { directionIndex, to } of network.movesByStop.get(stop) ?? []) {
      if (visited.has(to)) {
        continue;
      }
      const rating: MoveRating = [
        measureManhattanDistance(board, to, goal),
        directionRanks[directionIndex]!,
        to,
      ];
      if (isBetterRating(rating, bestRating)) {
        bestRating = rating;
        bestStop = to;
      }
    }
    if (bestStop === null) {
      route.pop();
    } else {
      visited.add(bestStop);
      route.push(bestStop);
    }
    moveCount += 1;
  }
  return moveCount;
}

/** 試行錯誤の手数の、同点の向きの順位4通りでの中央値（小数は切り捨て）。 */
export function countIceFloorMazeTrialMoves(
  board: IceFloorMazeBoard,
  graph: IceFloorMazeStopGraph,
  goal: number,
): number {
  const network = getStopNetwork(graph);
  const counts = directionRankOrders
    .map((directionRanks) =>
      countTrialMoves(board, network, goal, directionRanks),
    )
    .sort((left, right) => left - right);
  const middle = counts.length / 2;
  return Math.floor((counts[middle - 1]! + counts[middle]!) / 2);
}
