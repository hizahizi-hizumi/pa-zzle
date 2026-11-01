import {
  classifyLooksReading,
  countRoles,
  createElementContext,
  hasStaticShortcut,
  type LooksReading,
  measureElementMetrics,
} from "@/games/ice-floor-maze/problem/generation/element-features";
import {
  STATE_READING_DEPTH_CAP,
  scoreElementHardnessWithReading,
} from "@/games/ice-floor-maze/problem/generation/element-objective";
import { measureStateReadingDepth } from "@/games/ice-floor-maze/problem/generation/reading-model";
import {
  CELL_BRITTLE,
  CELL_OUTSIDE,
  CELL_THIN,
  type GenerationBoard,
  toGenerationBoard,
  withGoal,
} from "@/games/ice-floor-maze/problem/generation/state-space";
import {
  countNearPaths,
  createStaticBoardGraph,
  createStaticStopper,
  listStaticTacticTags,
  MAXIMUM_READING_DEPTH,
  measureStaticReadingDepth,
  measureStaticTactics,
  type StaticTacticTag,
} from "@/games/ice-floor-maze/problem/generation/static-tactics";
import type {
  IceFloorMazeBoardShape,
  IceFloorMazeProblem,
} from "@/games/ice-floor-maze/problem/problem";

/** 盤面に置かれた要素の組み合わせ。`none` は氷と岩だけ。 */
export type IceFloorMazeElementComposition =
  | "none"
  | "brittle-rock"
  | "thin-ice"
  | "mixed";

/** 氷と岩だけの盤面の手筋のタグ（`StaticTacticTag` の定義を参照）。 */
export type IceFloorMazeTacticTag = StaticTacticTag;

/**
 * 氷と岩だけの盤面の特徴（研究用の生成 v2 の手筋）。
 * - `optimalMoveCount` / `optimalSolutionCount`: 最少手数と、最少手数で止まる向きの並びの数。
 * - `forcedMoveCount`: 最短の道筋のうち、戻らない選択肢が1つしかない手（一本道）。
 * - `reachableStopCount` / `deadStopCount`: 開始位置から止まれる停止点の数と、そのうちゴールへ止まれない停止点（詰み）の数。
 * - `tags`: 手筋のタグ。
 * - `readingDepth`: 前向き・逆向き・両方向の先読みのうち最も楽な方向で解ける読み手数。上限まで読めなければ `null`。
 * - `nearPathCount`: 最少手数+2手以内で、同じ停止点を二度通らない道筋の数（近い別解）。
 * - そのほかは手筋のタグの元になった数。
 */
export type IceFloorMazeTacticFeatures = {
  optimalMoveCount: number;
  optimalSolutionCount: number;
  forcedMoveCount: number;
  reachableStopCount: number;
  deadStopCount: number;
  tags: readonly IceFloorMazeTacticTag[];
  readingDepth: number | null;
  nearPathCount: number;
  passLureCount: number;
  trapLureCount: number;
  silentTrapLureCount: number;
  reentryCount: number;
  detourCount: number;
  funnelDepth: number;
  forkCount: number;
};

/**
 * もろい岩・薄い氷のある盤面の特徴（研究用の生成 v4）。
 * - `reachableStateCount` / `deadStateCount`: 開始状態から移れる状態の数と、そのうちゴールで止まれない状態（詰み）の数。
 * - `usedElementCount` / `decoyCount` / `weakDecoyCount` / `irrelevantElementCount`: 要素の役割ごとの数。
 *   おとりは最短解で変化させず、最短解から外れたもっともらしい手が変化させると詰みか遠回りになる要素。効かない要素は、
 *   中立の形（もろい岩→岩、薄い氷→氷）にしても最短解ともっともらしい選択肢が変わらない要素。
 * - `useCount`: 最短解で要素を使う回数（崩す・崩れた跡を通る・水面で止まる）。
 * - `orderDependencyCount` / `orderChain`: 最短解で使う順を入れ替えると解けなくなる要素の組の数と、その順序の最も長い連なり。
 * - `orderTrapCount`: 最短解が後で使う要素を先に変化させ、詰みか遠回りになる選択肢の数。
 * - `lureCount`: 最短解の上の、もっともらしいが詰みか遠回りになる選択肢の数。
 * - `solutionRepeatCount` / `nearRepeatCount` / `brittleChainCount`: 同じ向きが続く手（条件1）。最短解で同じ向きが続く手、
 *   最短+2手以内の道筋に乗る同じ向きが続く2手、もろい岩を崩した直後に同じ向きでもう一度もろい岩を崩せる2手。
 * - `looksReading`: 見た目どおりに読んだ盤面の結果。`staticShortcut` は、見た目どおりかもう一方の読みで短く解ける。
 * - `stateReadingDepth`: 規則を知って先を読む人が状態のグラフで解ける読み手数。上限まで読めなければ `null`。
 * - `hardness`: 難しさの点（研究用 v4 の点に状態の読み深さを足したもの。大きいほど難しい）。
 */
export type IceFloorMazeElementFeatures = {
  optimalMoveCount: number;
  optimalSolutionCount: number;
  forcedMoveCount: number;
  reachableStateCount: number;
  deadStateCount: number;
  elementCount: number;
  brittleRockCount: number;
  thinIceCount: number;
  usedElementCount: number;
  decoyCount: number;
  weakDecoyCount: number;
  irrelevantElementCount: number;
  useCount: number;
  orderDependencyCount: number;
  orderChain: number;
  orderTrapCount: number;
  lureCount: number;
  solutionRepeatCount: number;
  nearRepeatCount: number;
  brittleChainCount: number;
  looksReading: LooksReading;
  staticShortcut: boolean;
  stateReadingDepth: number | null;
  hardness: number;
};

/**
 * - `analyzed`: 解けて、特徴を求めた。氷と岩だけの盤面は手筋の特徴、要素のある盤面は要素の特徴。
 * - `unsupported`: 状態の数が上限を超え、特徴を求められない。
 * - `invalid`: ゴールが開始位置と同じか、ゴールへ止まれない（問題として成立しない）。
 */
export type IceFloorMazeDifficultyAnalysis =
  | {
      status: "analyzed";
      shape: IceFloorMazeBoardShape;
      composition: "none";
      features: IceFloorMazeTacticFeatures;
    }
  | {
      status: "analyzed";
      shape: IceFloorMazeBoardShape;
      composition: Exclude<IceFloorMazeElementComposition, "none">;
      features: IceFloorMazeElementFeatures;
    }
  | {
      status: "unsupported";
      reason: "state-limit-exceeded";
      shape: IceFloorMazeBoardShape;
    }
  | {
      status: "invalid";
      reason: "goal-unreachable";
      shape: IceFloorMazeBoardShape;
    };

function analyzeTactics(
  board: GenerationBoard,
  start: number,
  goal: number,
): IceFloorMazeTacticFeatures | null {
  const outside = board.cells.map((code) => (code === CELL_OUTSIDE ? 1 : 0));
  const graph = createStaticBoardGraph(
    board.width,
    board.height,
    createStaticStopper(board),
    start,
    outside,
  );
  if (graph.distances[goal]! <= 0) {
    return null;
  }
  const tactics = measureStaticTactics(graph, start, goal);
  const readingDepth = measureStaticReadingDepth(
    graph,
    start,
    goal,
    MAXIMUM_READING_DEPTH,
  );
  return {
    optimalMoveCount: tactics.shortest,
    optimalSolutionCount: tactics.optimalPathCount,
    forcedMoveCount: tactics.forcedMoveCount,
    reachableStopCount: graph.order.length,
    deadStopCount: tactics.deadStateCount,
    tags: listStaticTacticTags(tactics),
    readingDepth: readingDepth > MAXIMUM_READING_DEPTH ? null : readingDepth,
    nearPathCount: countNearPaths(graph, start, goal),
    passLureCount: tactics.passLureCount,
    trapLureCount: tactics.trapLureCount,
    silentTrapLureCount: tactics.silentTrapLureCount,
    reentryCount: tactics.reentryCount,
    detourCount: tactics.detourCount,
    funnelDepth: tactics.funnelDepth,
    forkCount: tactics.forkCount,
  };
}

function analyzeElements(
  board: GenerationBoard,
  start: number,
  goal: number,
): IceFloorMazeElementFeatures | "state-limit-exceeded" | null {
  const context = createElementContext(board, start);
  if (!context.free) {
    return "state-limit-exceeded";
  }
  const space = withGoal(context.free, goal);
  const metrics = measureElementMetrics(context, goal, space);
  if (!metrics || metrics.shortest === 0) {
    return null;
  }
  const readingDepth = measureStateReadingDepth(space, STATE_READING_DEPTH_CAP);
  return {
    optimalMoveCount: metrics.shortest,
    optimalSolutionCount: metrics.solutionCount,
    forcedMoveCount: metrics.forcedMoveCount,
    reachableStateCount: metrics.stateCount,
    deadStateCount: metrics.deadStateCount,
    elementCount: metrics.elementCount,
    brittleRockCount: metrics.brittleCount,
    thinIceCount: metrics.thinCount,
    usedElementCount: countRoles(metrics, "used"),
    decoyCount: countRoles(metrics, "decoy"),
    weakDecoyCount: countRoles(metrics, "weak-decoy"),
    irrelevantElementCount: countRoles(metrics, "irrelevant"),
    useCount: metrics.useCount,
    orderDependencyCount: metrics.precedenceCount,
    orderChain: metrics.orderChain,
    orderTrapCount: metrics.orderTrapCount,
    lureCount: metrics.lureCount,
    solutionRepeatCount: metrics.solutionRepeatCount,
    nearRepeatCount: metrics.nearRepeatCount,
    brittleChainCount: metrics.brittleChainCount,
    looksReading: classifyLooksReading(metrics),
    staticShortcut: hasStaticShortcut(metrics),
    stateReadingDepth:
      readingDepth > STATE_READING_DEPTH_CAP ? null : readingDepth,
    hardness: scoreElementHardnessWithReading(metrics, readingDepth),
  };
}

function findComposition(
  board: GenerationBoard,
): IceFloorMazeElementComposition {
  const codes = new Set(board.cells);
  const hasBrittle = codes.has(CELL_BRITTLE);
  const hasThin = codes.has(CELL_THIN);
  if (hasBrittle && hasThin) {
    return "mixed";
  }
  if (hasBrittle) {
    return "brittle-rock";
  }
  return hasThin ? "thin-ice" : "none";
}

/** 問題の難易度の特徴を求める。氷と岩だけの盤面は手筋、要素のある盤面は要素の特徴を求める。 */
export function analyzeIceFloorMazeDifficulty(
  problem: IceFloorMazeProblem,
): IceFloorMazeDifficultyAnalysis {
  const { start, goal } = problem;
  const board = toGenerationBoard(problem.board);
  const shape = { width: board.width, height: board.height };
  const composition = findComposition(board);
  if (composition === "none") {
    const features = analyzeTactics(board, start, goal);
    return features
      ? { status: "analyzed", shape, composition, features }
      : { status: "invalid", reason: "goal-unreachable", shape };
  }
  const features = analyzeElements(board, start, goal);
  if (features === "state-limit-exceeded") {
    return { status: "unsupported", reason: features, shape };
  }
  return features
    ? { status: "analyzed", shape, composition, features }
    : { status: "invalid", reason: "goal-unreachable", shape };
}
