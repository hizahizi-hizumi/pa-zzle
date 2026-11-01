import {
  type BallCache,
  createBallCache,
  createReadingGraph,
  getReadingMoveLimit,
  lookaheadSolves,
  TIE_ORDERS,
} from "@/games/ice-floor-maze/problem/generation/reading-model";
import {
  CELL_OUTSIDE,
  CELL_ROCK,
  DIRECTION_COUNT,
  type GenerationBoard,
} from "@/games/ice-floor-maze/problem/generation/state-space";

/**
 * 氷と岩だけの盤面の手筋の特徴量（研究用の生成 v2 `ice_floor_tactic_generation_experiment.py` の `board_graph`・`tactics_of`・
 * `shallow_depth`）と、v1 の近い別解（`near_path_count`）。盤面の外は岩と同じ止め役として扱う。
 */

const DX = [0, 1, 0, -1] as const;
const DY = [-1, 0, 1, 0] as const;

/** 近い道筋とみなす、最短手数からの遠回りの手数。 */
const NEAR_SLACK = 2;
/** 逆算の1段で候補がこの数以下なら「止め石を探す段」とみなす。 */
const FUNNEL_WIDTH = 2;
/** 偽の道とみなす、最短からの遠回りの手数。 */
const FALSE_LEAD_COST = 3;
/** 人のモデルが読む手数の上限。 */
export const MAXIMUM_READING_DEPTH = 12;
/** 近い別解を数える上限。 */
const NEAR_PATH_CAP = 5000;

/** 各マスから上・右・下・左へ滑って止まるマス。すぐ止め役・外壁なら自分自身（`stopper` のマスの値は使わない）。 */
function createStopTables(
  width: number,
  height: number,
  stopper: Uint8Array,
): Int32Array[] {
  const cellCount = width * height;
  const tables = Array.from(
    { length: DIRECTION_COUNT },
    () => new Int32Array(cellCount),
  );
  const [up, right, down, left] = tables as [
    Int32Array,
    Int32Array,
    Int32Array,
    Int32Array,
  ];
  for (let x = 0; x < width; x += 1) {
    let last = -1;
    for (let y = 0; y < height; y += 1) {
      const cell = y * width + x;
      if (stopper[cell] === 1) {
        last = -1;
        continue;
      }
      if (last < 0) {
        last = cell;
      }
      up[cell] = last;
    }
    last = -1;
    for (let y = height - 1; y >= 0; y -= 1) {
      const cell = y * width + x;
      if (stopper[cell] === 1) {
        last = -1;
        continue;
      }
      if (last < 0) {
        last = cell;
      }
      down[cell] = last;
    }
  }
  for (let y = 0; y < height; y += 1) {
    let last = -1;
    for (let x = 0; x < width; x += 1) {
      const cell = y * width + x;
      if (stopper[cell] === 1) {
        last = -1;
        continue;
      }
      if (last < 0) {
        last = cell;
      }
      left[cell] = last;
    }
    last = -1;
    for (let x = width - 1; x >= 0; x -= 1) {
      const cell = y * width + x;
      if (stopper[cell] === 1) {
        last = -1;
        continue;
      }
      if (last < 0) {
        last = cell;
      }
      right[cell] = last;
    }
  }
  return tables;
}

/**
 * 1つの盤面と開始位置について、ゴールによらない量。マスの番号がそのままノードの番号。
 * - `distances`: 開始位置からの最少手数。到達できなければ -1。
 * - `order`: 到達できる停止点を幅優先の順に並べたもの。
 * - `ends[4 * c + d]`: 停止点 `c` から `d` へ滑って止まるマス。動けなければ -1。
 * - `globalTables` / `globalPredecessors`: 盤面全体（到達できるかを問わない）の滑り。関係する岩と盤面の外だけを止め役にする。
 * - `startBall`: 開始位置と、そこから1手で止まる停止点。
 */
export type StaticBoardGraph = {
  width: number;
  height: number;
  cellCount: number;
  stopper: Uint8Array;
  tables: Int32Array[];
  distances: Int32Array;
  order: Int32Array;
  ends: Int32Array;
  predecessors: number[][];
  globalTables: Int32Array[];
  globalPredecessors: [direction: number, from: number][][];
  startBall: Set<number>;
  relevantRockCount: number;
};

function isInside(
  width: number,
  height: number,
  x: number,
  y: number,
): boolean {
  return x >= 0 && x < width && y >= 0 && y < height;
}

export function createStaticStopper(board: GenerationBoard): Uint8Array {
  return board.cells.map((code) =>
    code === CELL_ROCK || code === CELL_OUTSIDE ? 1 : 0,
  );
}

export function createStaticBoardGraph(
  width: number,
  height: number,
  stopper: Uint8Array,
  start: number,
  outside: Uint8Array | null = null,
): StaticBoardGraph {
  const cellCount = width * height;
  const tables = createStopTables(width, height, stopper);
  const distances = new Int32Array(cellCount).fill(-1);
  const ends = new Int32Array(cellCount * DIRECTION_COUNT).fill(-1);
  const order = [start];
  distances[start] = 0;
  const stoppers = new Uint8Array(cellCount);
  for (let index = 0; index < order.length; index += 1) {
    const state = order[index]!;
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const end = tables[direction]![state]!;
      const x = (end % width) + DX[direction]!;
      const y = Math.floor(end / width) + DY[direction]!;
      if (isInside(width, height, x, y)) {
        stoppers[y * width + x] = 1;
      }
      if (end === state) {
        continue;
      }
      ends[state * DIRECTION_COUNT + direction] = end;
      if (distances[end]! < 0) {
        distances[end] = distances[state]! + 1;
        order.push(end);
      }
    }
  }
  const predecessors = Array.from({ length: cellCount }, (): number[] => []);
  for (const state of order) {
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const end = ends[state * DIRECTION_COUNT + direction]!;
      if (end >= 0) {
        predecessors[end]!.push(state);
      }
    }
  }

  let relevantRockCount = 0;
  const globalStopper = new Uint8Array(cellCount);
  let sameAsStopper = true;
  for (let cell = 0; cell < cellCount; cell += 1) {
    relevantRockCount += stoppers[cell]!;
    globalStopper[cell] = stoppers[cell] === 1 || outside?.[cell] === 1 ? 1 : 0;
    if (globalStopper[cell] !== stopper[cell]) {
      sameAsStopper = false;
    }
  }
  const globalTables = sameAsStopper
    ? tables
    : createStopTables(width, height, globalStopper);
  const isNode = new Uint8Array(cellCount);
  isNode[start] = 1;
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (globalStopper[cell] === 0) {
      for (const table of globalTables) {
        isNode[table[cell]!] = 1;
      }
    }
  }
  const globalPredecessors = Array.from(
    { length: cellCount },
    (): [number, number][] => [],
  );
  for (let node = 0; node < cellCount; node += 1) {
    if (isNode[node] === 0) {
      continue;
    }
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const end = globalTables[direction]![node]!;
      if (end !== node) {
        globalPredecessors[end]!.push([direction, node]);
      }
    }
  }
  const startBall = new Set([start]);
  for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
    const end = ends[start * DIRECTION_COUNT + direction]!;
    if (end >= 0) {
      startBall.add(end);
    }
  }
  return {
    width,
    height,
    cellCount,
    stopper,
    tables,
    distances,
    order: Int32Array.from(order),
    ends,
    predecessors,
    globalTables,
    globalPredecessors,
    startBall,
    relevantRockCount,
  };
}

function measureBackwardLayers(
  graph: StaticBoardGraph,
  goal: number,
): Int32Array {
  const toGoal = new Int32Array(graph.cellCount).fill(-1);
  toGoal[goal] = 0;
  const queue = [goal];
  for (let index = 0; index < queue.length; index += 1) {
    const state = queue[index]!;
    for (const previous of graph.predecessors[state]!) {
      if (toGoal[previous]! < 0) {
        toGoal[previous] = toGoal[state]! + 1;
        queue.push(previous);
      }
    }
  }
  return toGoal;
}

function measureGlobalLayers(
  graph: StaticBoardGraph,
  goal: number,
): Int32Array {
  const toGoal = new Int32Array(graph.cellCount).fill(-1);
  toGoal[goal] = 0;
  const queue = [goal];
  for (let index = 0; index < queue.length; index += 1) {
    const state = queue[index]!;
    for (const [, previous] of graph.globalPredecessors[state]!) {
      if (toGoal[previous]! < 0) {
        toGoal[previous] = toGoal[state]! + 1;
        queue.push(previous);
      }
    }
  }
  return toGoal;
}

/** SPEC-019 の閉じ込め: 今の位置から滑って行けるどの位置からも今の位置へ戻れる。 */
function isConfined(graph: StaticBoardGraph, state: number): boolean {
  const ahead = new Set([state]);
  const queue = [state];
  for (let index = 0; index < queue.length; index += 1) {
    const from = queue[index]!;
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const end = graph.ends[from * DIRECTION_COUNT + direction]!;
      if (end >= 0 && !ahead.has(end)) {
        ahead.add(end);
        queue.push(end);
      }
    }
  }
  const back = measureBackwardLayers(graph, state);
  return [...ahead].every((cell) => back[cell]! >= 0);
}

/**
 * 最短の道筋（方向番号の小さい手を優先）と盤面から測る手筋。
 * 「もっともらしい手」は、滑った先がゴールへ近づく、ゴールと見通しで揃う、滑りがゴールを通過する、のどれかに当たる手。
 */
export type StaticTactics = {
  shortest: number;
  optimalPathCount: number;
  nearStateCount: number;
  deadStateCount: number;
  passLureCount: number;
  passTrapCount: number;
  passSlideCount: number;
  trapOptionCount: number;
  trapLureCount: number;
  silentTrapLureCount: number;
  reentryCount: number;
  wraps: boolean;
  funnelDepth: number;
  entryCount: number;
  forkCount: number;
  lureStepCount: number;
  forcedMoveCount: number;
  falseLeadCount: number;
  detourCount: number;
  awayRunCount: number;
  goalRockStop: boolean;
  rockStopCount: number;
  relevantRockCount: number;
};

export function measureStaticTactics(
  graph: StaticBoardGraph,
  start: number,
  goal: number,
): StaticTactics {
  const { width, height, tables, distances, ends, order } = graph;
  const goalX = goal % width;
  const goalY = Math.floor(goal / width);
  function gap(cell: number): number {
    return (
      Math.abs((cell % width) - goalX) +
      Math.abs(Math.floor(cell / width) - goalY)
    );
  }
  function toward(cell: number): number {
    const x = cell % width;
    const y = Math.floor(cell / width);
    if (x === goalX && y !== goalY) {
      return goalY > y ? 2 : 0;
    }
    if (y === goalY && x !== goalX) {
      return goalX > x ? 1 : 3;
    }
    return -1;
  }
  function sees(cell: number): boolean {
    const direction = toward(cell);
    if (direction < 0) {
      return false;
    }
    const end = tables[direction]![cell]!;
    const endX = end % width;
    const endY = Math.floor(end / width);
    return [endY <= goalY, endX >= goalX, endY >= goalY, endX <= goalX][
      direction
    ]!;
  }
  function passes(cell: number, direction: number): boolean {
    return (
      direction === toward(cell) &&
      sees(cell) &&
      tables[direction]![cell] !== goal
    );
  }
  function plausible(cell: number, direction: number, end: number): boolean {
    return (
      end === goal ||
      gap(end) < gap(cell) ||
      sees(end) ||
      passes(cell, direction)
    );
  }

  const toGoal = measureBackwardLayers(graph, goal);
  const shortest = distances[goal]!;
  const ways = new Float64Array(graph.cellCount);
  ways[start] = 1;
  for (const state of order) {
    if (ways[state] === 0) {
      continue;
    }
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const end = ends[state * DIRECTION_COUNT + direction]!;
      if (end >= 0 && distances[end] === distances[state]! + 1) {
        ways[end]! += ways[state]!;
      }
    }
  }
  const near: number[] = [];
  let deadStateCount = 0;
  for (const state of order) {
    if (toGoal[state]! < 0) {
      deadStateCount += 1;
    } else if (distances[state]! + toGoal[state]! <= shortest + NEAR_SLACK) {
      near.push(state);
    }
  }
  let passLureCount = 0;
  let passTrapCount = 0;
  for (const state of near) {
    if (state === goal) {
      continue;
    }
    const direction = toward(state);
    if (direction >= 0 && passes(state, direction)) {
      passLureCount += 1;
      if (toGoal[tables[direction]![state]!]! < 0) {
        passTrapCount += 1;
      }
    }
  }
  let passSlideCount = 0;
  for (const state of order) {
    const direction = toward(state);
    if (state !== goal && direction >= 0 && passes(state, direction)) {
      passSlideCount += 1;
    }
  }

  let state = start;
  const prefix = new Set([start]);
  const path = [start];
  let forcedMoveCount = 0;
  let forkCount = 0;
  let trapOptionCount = 0;
  let trapLureCount = 0;
  let rockStopCount = 0;
  let falseLeadCount = 0;
  let silentTrapLureCount = 0;
  const lured: boolean[] = [];
  let lastDirection = -1;
  while (state !== goal) {
    const remaining = toGoal[state]!;
    const options: [number, number][] = [];
    let next: [number, number] | null = null;
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const end = ends[state * DIRECTION_COUNT + direction]!;
      if (end < 0) {
        continue;
      }
      if (!prefix.has(end)) {
        options.push([direction, end]);
      }
      if (next === null && toGoal[end] === remaining - 1) {
        next = [direction, end];
      }
    }
    const [nextDirection, nextState] = next!;
    const good = options.filter(([direction, end]) =>
      plausible(state, direction, end),
    );
    if (options.length === 1) {
      forcedMoveCount += 1;
    }
    if (good.length >= 2) {
      forkCount += 1;
    }
    lured.push(good.length > 0 && !plausible(state, nextDirection, nextState));
    for (const [direction, end] of options) {
      const after = toGoal[end]!;
      const isPlausible = plausible(state, direction, end);
      if (after < 0) {
        trapOptionCount += 1;
        if (isPlausible) {
          trapLureCount += 1;
          if (!isConfined(graph, end)) {
            silentTrapLureCount += 1;
          }
        }
      }
      if (
        (after < 0 || after + 1 - remaining >= FALSE_LEAD_COST) &&
        isPlausible
      ) {
        falseLeadCount += 1;
      }
    }
    if (
      isInside(
        width,
        height,
        (nextState % width) + DX[nextDirection]!,
        Math.floor(nextState / width) + DY[nextDirection]!,
      )
    ) {
      rockStopCount += 1;
    }
    state = nextState;
    lastDirection = nextDirection;
    prefix.add(state);
    path.push(state);
  }

  const seenFlags = path.slice(0, -1).map(sees);
  const reentryCount = seenFlags.filter(
    (flag, index) => index > 0 && seenFlags[index - 1] && !flag,
  ).length;
  const awayFlags = path
    .slice(1)
    .map((cell, index) => gap(cell) > gap(path[index]!));
  const runStarts = awayFlags.flatMap((away, index) =>
    away && (index === 0 || !awayFlags[index - 1]) ? [index] : [],
  );
  const startX = start % width;
  const startY = Math.floor(start / width);
  const wraps =
    DX[lastDirection]! * (startX - goalX) +
      DY[lastDirection]! * (startY - goalY) >
    0;

  const globalToGoal = measureGlobalLayers(graph, goal);
  const layerSizes = new Int32Array(graph.cellCount + 1);
  const layerTouchesStart = new Uint8Array(graph.cellCount + 1);
  let deepestLayer = 0;
  for (let cell = 0; cell < graph.cellCount; cell += 1) {
    const layer = globalToGoal[cell]!;
    if (layer < 0) {
      continue;
    }
    layerSizes[layer]! += 1;
    if (graph.startBall.has(cell)) {
      layerTouchesStart[layer] = 1;
    }
    deepestLayer = Math.max(deepestLayer, layer);
  }
  let funnelDepth = 0;
  for (let layer = 1; layer <= deepestLayer; layer += 1) {
    const size = layerSizes[layer]!;
    if (size === 0 || layerTouchesStart[layer] === 1 || size > FUNNEL_WIDTH) {
      break;
    }
    funnelDepth += 1;
  }

  const beyondGoalX = goalX + DX[lastDirection]!;
  const beyondGoalY = goalY + DY[lastDirection]!;
  return {
    shortest,
    optimalPathCount: ways[goal]!,
    nearStateCount: near.length - (shortest + 1),
    deadStateCount,
    passLureCount,
    passTrapCount,
    passSlideCount,
    trapOptionCount,
    trapLureCount,
    silentTrapLureCount,
    reentryCount,
    wraps,
    funnelDepth,
    entryCount: layerSizes[1]!,
    forkCount,
    lureStepCount: lured.filter(Boolean).length,
    forcedMoveCount,
    falseLeadCount,
    detourCount: runStarts.filter((index) => lured[index]).length,
    awayRunCount: runStarts.length,
    goalRockStop:
      isInside(width, height, beyondGoalX, beyondGoalY) &&
      graph.stopper[beyondGoalY * width + beyondGoalX] === 1,
    rockStopCount,
    relevantRockCount: graph.relevantRockCount,
  };
}

/** 手筋のタグ。研究用 v2 の `TAG_RULES`。 */
const staticTacticTags = [
  "stopper",
  "wrap-around",
  "pass-lure",
  "reentry",
  "trap-lure",
  "pass-trap",
  "silent-trap",
  "detour",
  "double-detour",
  "backward-funnel",
  "fork",
] as const;

/**
 * - `stopper`（止め石）: 最後の滑りを岩で止め、ゴールに1手で止まれる停止点（盤面全体）が2つ以下。
 * - `wrap-around`（回り込み）: 最後の滑りが開始位置の側へ向かう。
 * - `pass-lure`（通過の誘い）/ `pass-trap`（通過で詰む）: 近い道筋の停止点から、ゴールを通過して止まらない滑り／その先が詰み。
 * - `reentry`（入り直し）: 最短の道筋でゴールと見通しで揃った停止点から揃わない停止点へ離れる。
 * - `trap-lure`（詰みの誘い）/ `silent-trap`（知らせのない詰み）: 最短の道筋上で詰みに入るもっともらしい選択肢／入った直後に閉じ込めの知らせが出ないもの。
 * - `detour`（遠回り）/ `double-detour`（遠回り2回）: もっともらしい別の手を捨てて始まる、ゴールから離れる区間が1つ以上／2つ以上。
 * - `backward-funnel`（逆算3段）: ゴールから逆にたどり、候補が2つ以下の段が3段以上続く。
 * - `fork`（分かれ道）: もっともらしい選択肢が2つ以上ある手が最短手数の1/4以上。
 */
export type StaticTacticTag = (typeof staticTacticTags)[number];

const tagRules = {
  stopper: (t) => t.goalRockStop && t.entryCount <= 2,
  "wrap-around": (t) => t.wraps,
  "pass-lure": (t) => t.passLureCount >= 1,
  reentry: (t) => t.reentryCount >= 1,
  "trap-lure": (t) => t.trapLureCount >= 1,
  "pass-trap": (t) => t.passTrapCount >= 1,
  "silent-trap": (t) => t.silentTrapLureCount >= 1,
  detour: (t) => t.detourCount >= 1,
  "double-detour": (t) => t.detourCount >= 2,
  "backward-funnel": (t) => t.funnelDepth >= 3,
  fork: (t) => t.forkCount * 4 >= t.shortest,
} as const satisfies Record<
  StaticTacticTag,
  (tactics: StaticTactics) => boolean
>;

export function hasStaticTacticTag(
  tactics: StaticTactics,
  tag: StaticTacticTag,
): boolean {
  return tagRules[tag](tactics);
}

export function listStaticTacticTags(
  tactics: StaticTactics,
): StaticTacticTag[] {
  return staticTacticTags.filter((tag) => tagRules[tag](tactics));
}

/** 盤面の読みのグラフ（到達できる停止点の前向きと、盤面全体の逆向き）と、それぞれの `ball` の覚え。 */
export type StaticReadingCaches = { forward: BallCache; backward: BallCache };

function createStaticReadingCaches(
  graph: StaticBoardGraph,
): StaticReadingCaches {
  const forwardEdges: [number, number, number][] = [];
  for (const state of graph.order) {
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const end = graph.ends[state * DIRECTION_COUNT + direction]!;
      if (end >= 0) {
        forwardEdges.push([state, direction, end]);
      }
    }
  }
  const backwardEdges: [number, number, number][] = [];
  graph.globalPredecessors.forEach((entries, node) => {
    for (const [direction, from] of entries) {
      backwardEdges.push([node, direction, from]);
    }
  });
  return {
    forward: createBallCache(createReadingGraph(graph.cellCount, forwardEdges)),
    backward: createBallCache(
      createReadingGraph(graph.cellCount, backwardEdges),
    ),
  };
}

/** 見通しで揃っていない位置の点を、揃った位置のどれよりも悪くする。 */
const ALIGNMENT_PENALTY = 1000;

/**
 * v1 の読み深さ（前向き・逆向き・両方向の先読みのうち最も楽な方向で解ける読み手数）を `maximumDepth` まで求める。
 * `maximumDepth` でも読めなければ `maximumDepth + 1`。
 */
export function measureStaticReadingDepth(
  graph: StaticBoardGraph,
  start: number,
  goal: number,
  maximumDepth: number,
  caches: StaticReadingCaches = createStaticReadingCaches(graph),
): number {
  const { width, cellCount, globalTables } = graph;
  const shortest = graph.distances[goal]!;
  const limit = getReadingMoveLimit(shortest);
  const toGoal = measureGlobalLayers(graph, goal);
  function gapTo(target: number): (cell: number) => number {
    const targetX = target % width;
    const targetY = Math.floor(target / width);
    return (cell) =>
      Math.abs((cell % width) - targetX) +
      Math.abs(Math.floor(cell / width) - targetY);
  }
  function isAligned(from: number, to: number): boolean {
    const fromX = from % width;
    const fromY = Math.floor(from / width);
    const toX = to % width;
    const toY = Math.floor(to / width);
    let direction: number;
    if (fromX === toX && fromY !== toY) {
      direction = toY > fromY ? 2 : 0;
    } else if (fromY === toY && fromX !== toX) {
      direction = toX > fromX ? 1 : 3;
    } else {
      return from === to;
    }
    const end = globalTables[direction]![from]!;
    const endX = end % width;
    const endY = Math.floor(end / width);
    return [endY <= toY, endX >= toX, endY >= toY, endX <= toX][direction]!;
  }
  function toward(target: number, align: boolean): (cell: number) => number {
    const gap = gapTo(target);
    return align
      ? (cell) => (isAligned(cell, target) ? 0 : ALIGNMENT_PENALTY) + gap(cell)
      : gap;
  }
  function single(cell: number): Uint8Array {
    const targets = new Uint8Array(cellCount);
    targets[cell] = 1;
    return targets;
  }
  const goalTargets = single(goal);
  const startTargets = single(start);

  for (let depth = 1; depth <= maximumDepth; depth += 1) {
    const members = new Uint8Array(cellCount);
    const memberGaps: ((cell: number) => number)[] = [];
    toGoal.forEach((layer, cell) => {
      if (layer >= 0 && layer <= depth) {
        members[cell] = 1;
        memberGaps.push(gapTo(cell));
      }
    });
    const attempts = [
      [caches.forward, start, goalTargets, toward(goal, false)],
      [caches.forward, start, goalTargets, toward(goal, true)],
      [caches.backward, goal, startTargets, toward(start, false)],
      [caches.backward, goal, startTargets, toward(start, true)],
      [
        caches.forward,
        start,
        members,
        (cell: number) => Math.min(...memberGaps.map((gap) => gap(cell))),
      ],
    ] as const;
    for (const [cache, origin, targets, score] of attempts) {
      for (const order of TIE_ORDERS) {
        if (
          lookaheadSolves(cache, origin, targets, score, depth, limit, order)
        ) {
          return depth;
        }
      }
    }
  }
  return maximumDepth + 1;
}

/** 最少手数+`NEAR_SLACK` 手以内で、同じ停止点を二度通らない道筋の数（v1 の `near_path_count`。上限 `NEAR_PATH_CAP`）。 */
export function countNearPaths(
  graph: StaticBoardGraph,
  start: number,
  goal: number,
): number {
  const toGoal = measureBackwardLayers(graph, goal);
  const budget = graph.distances[goal]! + NEAR_SLACK;
  const onPath = new Uint8Array(graph.cellCount);
  let count = 0;
  function visit(state: number, used: number): void {
    if (count >= NEAR_PATH_CAP) {
      return;
    }
    if (state === goal) {
      count += 1;
      return;
    }
    onPath[state] = 1;
    for (let direction = DIRECTION_COUNT - 1; direction >= 0; direction -= 1) {
      const end = graph.ends[state * DIRECTION_COUNT + direction]!;
      if (end < 0 || onPath[end] === 1) {
        continue;
      }
      const remaining = toGoal[end]!;
      if (remaining < 0 || used + 1 + remaining > budget) {
        continue;
      }
      visit(end, used + 1);
    }
    onPath[state] = 0;
  }
  visit(start, 0);
  return count;
}

/** 止め役でないマスのうち、到達できるどの滑りでも駒が通らない・止まらないマス（盤面の外になるマス）の数。 */
export function countUnusedStaticCells(graph: StaticBoardGraph): number {
  const { width, cellCount, order, ends, stopper } = graph;
  const steps = DX.map((dx, direction) => DY[direction]! * width + dx);
  const used = new Uint8Array(cellCount);
  for (const state of order) {
    used[state] = 1;
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const end = ends[state * DIRECTION_COUNT + direction]!;
      for (let cell = state; end >= 0 && cell !== end; ) {
        cell += steps[direction]!;
        used[cell] = 1;
      }
    }
  }
  let unused = 0;
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (stopper[cell] === 0 && used[cell] === 0) {
      unused += 1;
    }
  }
  return unused;
}
