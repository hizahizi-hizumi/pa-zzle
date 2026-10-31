import {
  countIceFloorMazeTrialMoves,
  findIceFloorMazePlanningDepth,
  type IceFloorMazePlanningStrategy,
} from "@/games/ice-floor-maze/problem/generation/planning-player";
import type {
  IceFloorMazeBoardShape,
  IceFloorMazeProblem,
} from "@/games/ice-floor-maze/problem/problem";
import {
  getIceFloorMazeCellPosition,
  type IceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";
import {
  exploreIceFloorMazeStops,
  type IceFloorMazeStopGraph,
  listIceFloorMazeStopMoves,
} from "@/games/ice-floor-maze/puzzle/stop-graph";

/**
 * 先読みのプレイヤーが読む手数の上限。7手以上先を頭の中で滑らせる人は考えにくく、
 * それより深く読まないと解けない問題は、このモデルでは挑戦の強さを説明できない。
 */
export const ICE_FLOOR_MAZE_MAXIMUM_PLANNING_DEPTH = 6;

/** 先読みのプレイヤーが諦めるまでの手数。最短の道筋から大きく外れて歩き回る解き方は、計画して解いたとみなさない。 */
function getPlanningMoveLimit(optimalMoveCount: number): number {
  return 4 * optimalMoveCount + 8;
}

/**
 * 問題が求める挑戦の特徴。
 * - `optimalMoveCount` / `optimalSolutionCount`: 最少手数と、最少手数で止まる向きの並びの数。
 * - `reachableStopCount`: 開始位置から止まれる停止点の数（開始位置を含む）。各手で比べる止まり先の多さ。
 * - `approachPlanningDepth` / `alignPlanningDepth`: 「近づく」「揃える」方針の先読みのプレイヤーが解ける最小の読み手数。
 *   読む手数の上限まで読んでも解けなければ `null`。
 * - `trialMoveCount`: 待ったを使って近づく順に試す試行錯誤で、ゴールに止まるまでの手数（待ったも1手）。
 * - `detourMoveCount`: 最少手数の道筋のうち、ゴールとのマンハッタン距離を縮めない手の最小数。
 * - `goalPassingStopCount`: ゴールを止まらずに通り過ぎる滑りを持つ停止点の数。
 * - `deadStopCount`: 止まれるが、そこからゴールへ止まれない停止点（詰み）の数。
 *
 * 分類に使うのは計画深さと最少手数で、ほかはレベルと単調な関係が無いことを確かめるための補助の観点。
 */
export type IceFloorMazeDifficultyFeatures = {
  optimalMoveCount: number;
  optimalSolutionCount: number;
  reachableStopCount: number;
  approachPlanningDepth: number | null;
  alignPlanningDepth: number | null;
  trialMoveCount: number;
  detourMoveCount: number;
  goalPassingStopCount: number;
  deadStopCount: number;
};

/**
 * - `analyzed`: 先読みのプレイヤーが読む手数の上限までに解けた。`planningDepth` は2方針のうち小さい方の読み手数で、
 *   止まる場所を何手先まで頭の中で繋ぐ必要があるか（計画深さ）を表す。`strategies` はその読み手数で解けた方針。
 * - `unsupported`: ゴールへ止まれるが、上限まで読んでもどちらの方針でも解けない（評価不能）。
 * - `invalid`: ゴールが開始位置と同じか、ゴールへ止まれない（問題として成立しない）。
 */
export type IceFloorMazeDifficultyAnalysis =
  | {
      status: "analyzed";
      shape: IceFloorMazeBoardShape;
      planningDepth: number;
      strategies: readonly IceFloorMazePlanningStrategy[];
      features: IceFloorMazeDifficultyFeatures;
    }
  | {
      status: "unsupported";
      reason: "planning-depth-limit-exceeded";
      shape: IceFloorMazeBoardShape;
      features: IceFloorMazeDifficultyFeatures;
    }
  | {
      status: "invalid";
      reason: "goal-unreachable";
      shape: IceFloorMazeBoardShape;
    };

function measureManhattanDistance(
  board: IceFloorMazeBoard,
  from: number,
  to: number,
): number {
  const a = getIceFloorMazeCellPosition(board, from);
  const b = getIceFloorMazeCellPosition(board, to);
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** 最少手数の道筋の上で、手前の停止点から1手で進む移動。停止点は最少手数の昇順に並ぶ。 */
function listShortestStepsInOrder(
  graph: IceFloorMazeStopGraph,
): { from: number; to: number }[] {
  return graph.stops.flatMap((from) =>
    listIceFloorMazeStopMoves(graph, from)
      .filter(
        ({ to }) =>
          graph.moveCounts.get(to) === graph.moveCounts.get(from)! + 1,
      )
      .map(({ to }) => ({ from, to })),
  );
}

function countOptimalSolutions(
  graph: IceFloorMazeStopGraph,
  goal: number,
): number {
  const solutionCounts = new Map([[graph.origin, 1]]);
  for (const { from, to } of listShortestStepsInOrder(graph)) {
    solutionCounts.set(
      to,
      (solutionCounts.get(to) ?? 0) + (solutionCounts.get(from) ?? 0),
    );
  }
  return solutionCounts.get(goal) ?? 0;
}

function countDetourMoves(
  board: IceFloorMazeBoard,
  graph: IceFloorMazeStopGraph,
  goal: number,
): number {
  const detours = new Map([[graph.origin, 0]]);
  for (const { from, to } of listShortestStepsInOrder(graph)) {
    const reached = detours.get(from);
    if (reached === undefined) {
      continue;
    }
    const movesAway =
      measureManhattanDistance(board, to, goal) >=
      measureManhattanDistance(board, from, goal);
    const detour = reached + (movesAway ? 1 : 0);
    if (detour < (detours.get(to) ?? Number.POSITIVE_INFINITY)) {
      detours.set(to, detour);
    }
  }
  return detours.get(goal)!;
}

function countGoalPassingStops(
  graph: IceFloorMazeStopGraph,
  goal: number,
): number {
  return graph.stops.filter((stop) =>
    listIceFloorMazeStopMoves(graph, stop).some(
      ({ to, path }) => to !== goal && path.includes(goal),
    ),
  ).length;
}

function countDeadStops(graph: IceFloorMazeStopGraph, goal: number): number {
  const predecessors = new Map<number, number[]>(
    graph.stops.map((stop) => [stop, []]),
  );
  for (const stop of graph.stops) {
    for (const { to } of listIceFloorMazeStopMoves(graph, stop)) {
      predecessors.get(to)!.push(stop);
    }
  }

  const alive = new Set([goal]);
  const pending = [goal];
  while (pending.length > 0) {
    for (const predecessor of predecessors.get(pending.pop()!)!) {
      if (!alive.has(predecessor)) {
        alive.add(predecessor);
        pending.push(predecessor);
      }
    }
  }
  return graph.stops.length - alive.size;
}

/**
 * 問題の難易度の特徴を求める。
 * 同じ盤面と開始位置で多くのゴールを分析するときは、`exploreIceFloorMazeStops` の結果を `graph` に渡して使い回す。
 */
export function analyzeIceFloorMazeDifficulty(
  problem: IceFloorMazeProblem,
  graph: IceFloorMazeStopGraph = exploreIceFloorMazeStops(
    problem.board,
    problem.start,
  ),
): IceFloorMazeDifficultyAnalysis {
  const { board, goal } = problem;
  const shape = { width: board.width, height: board.height };
  const optimalMoveCount = graph.moveCounts.get(goal);
  if (optimalMoveCount === undefined || optimalMoveCount === 0) {
    return { status: "invalid", reason: "goal-unreachable", shape };
  }

  const limits = {
    maximumDepth: ICE_FLOOR_MAZE_MAXIMUM_PLANNING_DEPTH,
    moveLimit: getPlanningMoveLimit(optimalMoveCount),
  };
  const planningDepths = {
    approach: findIceFloorMazePlanningDepth(
      board,
      graph,
      goal,
      "approach",
      limits,
    ),
    align: findIceFloorMazePlanningDepth(board, graph, goal, "align", limits),
  } as const satisfies Record<IceFloorMazePlanningStrategy, number | null>;
  const features: IceFloorMazeDifficultyFeatures = {
    optimalMoveCount,
    optimalSolutionCount: countOptimalSolutions(graph, goal),
    reachableStopCount: graph.stops.length,
    approachPlanningDepth: planningDepths.approach,
    alignPlanningDepth: planningDepths.align,
    trialMoveCount: countIceFloorMazeTrialMoves(board, graph, goal),
    detourMoveCount: countDetourMoves(board, graph, goal),
    goalPassingStopCount: countGoalPassingStops(graph, goal),
    deadStopCount: countDeadStops(graph, goal),
  };

  const solvedDepths = Object.values(planningDepths).filter(
    (depth): depth is number => depth !== null,
  );
  if (solvedDepths.length === 0) {
    return {
      status: "unsupported",
      reason: "planning-depth-limit-exceeded",
      shape,
      features,
    };
  }

  const planningDepth = Math.min(...solvedDepths);
  const strategies = (
    Object.keys(planningDepths) as IceFloorMazePlanningStrategy[]
  ).filter((strategy) => planningDepths[strategy] === planningDepth);
  return { status: "analyzed", shape, planningDepth, strategies, features };
}
