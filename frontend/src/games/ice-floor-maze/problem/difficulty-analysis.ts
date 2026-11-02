import {
  classifyLooksReading,
  countRoles,
  createElementContext,
  hasStaticShortcut,
  type LooksReading,
  measureElementMetrics,
  type SolutionTexture,
} from "@/games/ice-floor-maze/problem/generation/element-features";
import {
  STATE_READING_DEPTH_CAP,
  scoreElementHardnessWithReading,
} from "@/games/ice-floor-maze/problem/generation/element-objective";
import { measureStateReadingDepth } from "@/games/ice-floor-maze/problem/generation/reading-model";
import {
  CELL_BLOCK,
  CELL_BRITTLE,
  CELL_FLOOR,
  CELL_OUTSIDE,
  CELL_SNOW,
  CELL_THIN,
  type GenerationBoard,
  toGenerationBoard,
  withGoal,
} from "@/games/ice-floor-maze/problem/generation/state-space";
import {
  countNearPaths,
  createStaticBoardGraph,
  createStaticFloor,
  createStaticStopper,
  listStaticTacticTags,
  MAXIMUM_READING_DEPTH,
  measureStaticFloors,
  measureStaticReadingDepth,
  measureStaticTactics,
  type StaticFloorFeatures,
  type StaticTacticTag,
} from "@/games/ice-floor-maze/problem/generation/static-tactics";
import type {
  IceFloorMazeBoardShape,
  IceFloorMazeProblem,
} from "@/games/ice-floor-maze/problem/problem";

/**
 * 盤面に置かれた要素の組み合わせ。`none` は要素が無く、氷と岩（と床）だけ。`mixed` はもろい岩と薄い氷、`snow-thin-ice` は雪と
 * 薄い氷、`sliding-block-thin-ice` は滑る氷の塊と薄い氷。`other` はそれ以外の組み合わせ（どのレベルにも当たらない）。
 */
export type IceFloorMazeElementComposition =
  | "none"
  | "brittle-rock"
  | "thin-ice"
  | "mixed"
  | "snow"
  | "snow-thin-ice"
  | "sliding-block"
  | "sliding-block-thin-ice"
  | "other";

/** 氷と岩だけの盤面の手筋のタグ（`StaticTacticTag` の定義を参照）。 */
export type IceFloorMazeTacticTag = StaticTacticTag;

/**
 * 床の働き。`StaticFloorFeatures` の定義を参照。`splitReadingDepth` は、止まる床が無ければ元の読み深さと同じ値で、
 * 上限まで読めなければ `null`。
 */
export type IceFloorMazeFloorFeatures = Omit<
  StaticFloorFeatures,
  "splitReadingDepth"
> & { splitReadingDepth: number | null };

/**
 * 氷と岩（と床）だけの盤面の特徴（研究用の生成 v2 の手筋）。
 * - `optimalMoveCount` / `optimalSolutionCount`: 最少手数と、最少手数で止まる向きの並びの数。
 * - `forcedMoveCount`: 最短の道筋のうち、戻らない選択肢が1つしかない手（一本道）。
 * - `reachableStopCount` / `deadStopCount`: 開始位置から止まれる停止点の数と、そのうちゴールへ止まれない停止点（詰み）の数。
 * - `tags`: 手筋のタグ。
 * - `readingDepth`: 前向き・逆向き・両方向の先読みのうち最も楽な方向で解ける読み手数。上限まで読めなければ `null`。
 * - `nearPathCount`: 最少手数+2手以内で、同じ停止点を二度通らない道筋の数（近い別解）。
 * - `shortSlideCount` / `averageSlideLength` / `longestChoicelessStair`: 最短の道筋の1マスだけの滑りの数、滑りの長さの平均、
 *   もっともらしい別の手が無い手だけで直交する2つの向きを交互に続けた最も長い連なり（選択肢の無い階段）。
 * - `floors`: 床の働き。
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
  shortSlideCount: number;
  averageSlideLength: number;
  longestChoicelessStair: number;
  floors: IceFloorMazeFloorFeatures;
};

/**
 * 要素（もろい岩・薄い氷・雪・滑る氷の塊）のある盤面の特徴（研究用の生成 v4。自分で作った地形の数え方は v5）。
 * - `reachableStateCount` / `deadStateCount`: 開始状態から移れる状態の数と、そのうちゴールで止まれない状態（詰み）の数。
 * - `usedElementCount` / `decoyCount` / `weakDecoyCount` / `irrelevantElementCount`: 要素の役割ごとの数。
 *   おとりは最短解で変化させず、最短解から外れたもっともらしい手が変化させると詰みか遠回りになる要素。効かない要素は、
 *   中立の形（もろい岩→岩、薄い氷→氷、雪→入ると止まる床、滑る氷の塊→岩）にしても最短解ともっともらしい選択肢が変わらない要素。
 * - `useCount`: 最短解で要素を使う回数（崩す・雪を押し出す・塊を動かす・自分で作った地形を使う）。
 * - `orderDependencyCount` / `orderChain`: 最短解で使う順を入れ替えると解けなくなる要素の組の数と、その順序の最も長い連なり。
 * - `orderTrapCount`: 最短解が後で使う要素を先に変化させ、詰みか遠回りになる選択肢の数。
 * - `lureCount`: 最短解の上の、もっともらしいが詰みか遠回りになる選択肢の数。
 * - `solutionRepeatCount` / `nearRepeatCount` / `elementChainCount`: 同じ向きが続く手（条件1）。最短解で同じ向きが続く手、
 *   最短+2手以内の道筋に乗る同じ向きが続く2手、要素を働かせた直後に同じ向きでもう一度同じ種類の要素を働かせる2手（もろい岩を
 *   続けて崩す・雪を続けて押し出す・塊を続けて動かす。到達できる全状態で数える）。
 * - `looksReading`: 見た目どおりに読んだ盤面の結果。`staticShortcut` は、見た目どおりかもう一方の読みで短く解ける。
 *   `looksShortest` は見た目どおりの盤面の最少手数（解なしは `null`）、`looksPassingMoveCount` はその近い解のうちこの規則でも
 *   ゴールで止まるものの、この規則での最少手数（通るものが無ければ `null`）。
 * - `lingeringDecoyCount`: おとりのうち、もっともらしい手で変化させた直後が閉じ込めにならない（遠回りか、まだ動き回れる詰み）もの。
 * - `rockShare`: 盤面として描くマスのうち岩の割合。
 * - `texture`: 最短解の手触り（滑りの長さ・階段・読みどころの無い区間・自分で作った地形の使い方・変わるマスの散らばり）。
 * - `selfMadeDependence`: 自作依存の点（前の自分の手が作った止め役・通り道にどれだけ頼るか。最短解が複数あれば最も低い解の点）。
 *   試遊の記録で人の難しさと最もよく揃った特徴量で、レベル3〜5 の段を分ける。
 * - `hardness`: 研究用 v4 の難しさの点に状態の読み深さを足したもの。試遊の難しさとは揃わなかったので段には使わない（比べるために残す）。
 * - `stateReadingDepth`: 規則を知って先を読む人が状態のグラフで解ける読み手数。上限まで読めなければ `null`。
 * - `floorCount`: 床の数。要素のある盤面の床の働き（目印にならないか）は測らないので、レベルの基準で床を置かない。
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
  snowCount: number;
  slidingBlockCount: number;
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
  elementChainCount: number;
  looksReading: LooksReading;
  staticShortcut: boolean;
  looksShortest: number | null;
  looksPassingMoveCount: number | null;
  lingeringDecoyCount: number;
  rockShare: number;
  texture: SolutionTexture;
  selfMadeDependence: number;
  stateReadingDepth: number | null;
  hardness: number;
  floorCount: number;
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
    createStaticFloor(board),
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
  const floors = measureStaticFloors(graph, start, goal, MAXIMUM_READING_DEPTH);
  const splitReadingDepth =
    floors.floorStopCount === 0 ? readingDepth : floors.splitReadingDepth;
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
    shortSlideCount: tactics.shortSlideCount,
    averageSlideLength: tactics.averageSlideLength,
    longestChoicelessStair: tactics.longestChoicelessStair,
    floors: {
      ...floors,
      splitReadingDepth:
        splitReadingDepth > MAXIMUM_READING_DEPTH ? null : splitReadingDepth,
    },
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
    snowCount: metrics.snowCount,
    slidingBlockCount: metrics.blockCount,
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
    elementChainCount: metrics.elementChainCount,
    looksReading: classifyLooksReading(metrics),
    staticShortcut: hasStaticShortcut(metrics),
    looksShortest: metrics.looks.shortest,
    looksPassingMoveCount: metrics.looks.passingMoveCount,
    lingeringDecoyCount: metrics.lingeringDecoyCount,
    rockShare: metrics.rockShare,
    texture: metrics.texture,
    selfMadeDependence: metrics.selfMadeDependence,
    stateReadingDepth:
      readingDepth > STATE_READING_DEPTH_CAP ? null : readingDepth,
    hardness: scoreElementHardnessWithReading(metrics, readingDepth),
    floorCount: board.cells.filter((code) => code === CELL_FLOOR).length,
  };
}

const compositionByTiles = new Map<string, IceFloorMazeElementComposition>([
  ["", "none"],
  [String([CELL_BRITTLE]), "brittle-rock"],
  [String([CELL_THIN]), "thin-ice"],
  [String([CELL_BRITTLE, CELL_THIN]), "mixed"],
  [String([CELL_THIN, CELL_SNOW]), "snow-thin-ice"],
  [String([CELL_SNOW]), "snow"],
  [String([CELL_THIN, CELL_BLOCK]), "sliding-block-thin-ice"],
  [String([CELL_BLOCK]), "sliding-block"],
]);

function findComposition(
  board: GenerationBoard,
): IceFloorMazeElementComposition {
  const tiles = [CELL_BRITTLE, CELL_THIN, CELL_SNOW, CELL_BLOCK].filter(
    (code) => board.cells.includes(code),
  );
  return compositionByTiles.get(String(tiles)) ?? "other";
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
