import {
  type BridgesBoard,
  getBridgesNetwork,
  parseBridgesBoard,
} from "@/games/bridges/puzzle/board";
import type { BridgeCount } from "@/games/bridges/puzzle/state";

/**
 * 例が見せる手1つ。押す所の手がかりを付ける所と、そこでする手で表す。
 * - `edge`: 島の間を押して、その辺の橋を回す（本番で阻まれる手もこれで見せる）。
 * - `drag`: `island` から相手の島へなぞって、その辺の橋を回す。なぞったときだけ手を進める。
 * - `select`: 島を押して選ぶ。
 * - `pair`: 選んだ島の相手の `island` を押して、その間の辺の橋を回す。島を選んでから押したときだけ手を進める。
 * - `backward`: 島の間を右クリックして、その辺の橋を逆に回す。
 * - `crossing`: 2本の線が交わる所を押して、どちらの橋も回さずに2本の線を示させる。
 */
export type BridgesHowToPlayHint =
  | { kind: "edge"; edge: number }
  | { kind: "drag"; edge: number; island: number }
  | { kind: "select"; island: number }
  | { kind: "pair"; edge: number; island: number }
  | { kind: "backward"; edge: number }
  | { kind: "crossing"; edges: readonly [number, number] };

/**
 * 触れる例1つ。盤面と、触る前の橋と、例が見せる手（打つ順）。どの例も本番の盤面部品で、本番と同じに動く。
 * `markedIsland` は、手ごとに架けられるかの印を、その島から出る橋の無い線に付ける例で渡す。
 */
export type BridgesHowToPlayExample = {
  board: BridgesBoard;
  bridges: readonly BridgeCount[];
  hints: readonly BridgesHowToPlayHint[];
  markedIsland?: number;
};

/** ルールの例の対。左にできる形、右にできない形。 */
export type BridgesHowToPlayExamplePair = readonly [
  BridgesHowToPlayExample,
  BridgesHowToPlayExample,
];

type CellPosition = readonly [row: number, column: number];

function findIsland(board: BridgesBoard, [row, column]: CellPosition): number {
  const island = board.islands.findIndex(
    (candidate) => candidate.row === row && candidate.column === column,
  );
  if (island < 0) {
    throw new RangeError(`No Bridges island at ${row}:${column}`);
  }
  return island;
}

function findEdge(
  board: BridgesBoard,
  from: CellPosition,
  to: CellPosition,
): number {
  const fromIsland = findIsland(board, from);
  const toIsland = findIsland(board, to);
  const edge = getBridgesNetwork(board).edges.findIndex(
    (candidate) =>
      (candidate.from === fromIsland && candidate.to === toIsland) ||
      (candidate.from === toIsland && candidate.to === fromIsland),
  );
  if (edge < 0) {
    throw new RangeError("No Bridges edge between the islands");
  }
  return edge;
}

/** 辺ごとの橋の本数を、両端の島の位置と本数の組から作る。挙げない辺は橋なし。 */
function placeBridges(
  board: BridgesBoard,
  placed: readonly (readonly [CellPosition, CellPosition, BridgeCount])[],
): BridgeCount[] {
  const bridges = getBridgesNetwork(board).edges.map((): BridgeCount => 0);
  for (const [from, to, count] of placed) {
    bridges[findEdge(board, from, to)] = count;
  }
  return bridges;
}

/**
 * ゴールの盤面。レベル1の問題集の1問（7×7 に島11）で、解はこの1つ。
 * 架ける順は、左上の1から橋のつながりに沿って広げ、右の列の2本の後に、最後の橋（左下の2と右下の3の間）で全部の島をつなぎ、
 * そこから完成の光を渡す。
 *
 * ```text
 * 1.....2
 * ..4..2.
 * .......
 * 4.8..3.
 * .......
 * ..4..3.
 * 2.....3
 * ```
 */
const goalBoard = parseBridgesBoard([
  "1.....2",
  "..4..2.",
  ".......",
  "4.8..3.",
  ".......",
  "..4..3.",
  "2.....3",
]);

const goalSteps = (
  [
    [[0, 0], [3, 0], 1],
    [[3, 0], [3, 2], 2],
    [[3, 0], [6, 0], 1],
    [[3, 2], [1, 2], 2],
    [[1, 2], [1, 5], 2],
    [[3, 2], [3, 5], 2],
    [[3, 2], [5, 2], 2],
    [[3, 5], [5, 5], 1],
    [[5, 2], [5, 5], 2],
    [[0, 6], [6, 6], 2],
    [[6, 0], [6, 6], 1],
  ] as const
).map(([from, to, count]) => ({
  edge: findEdge(goalBoard, from, to),
  count: count as BridgeCount,
}));

export const goalFigure = {
  board: goalBoard,
  /** 架ける順の辺と、その辺に架ける本数。 */
  steps: goalSteps,
} as const satisfies {
  board: BridgesBoard;
  steps: readonly { edge: number; count: BridgeCount }[];
};

/**
 * 数字と同じ本数のルール。左上の2・右上の3・右下の1の3島で、行き先は2と3、3と1の2つ。
 * できる形は、2と3に2本、3と1に1本の、どの島もちょうどの完成した姿。本番と同じく完成した盤面は受け付けない。
 * できない形は、2と3に1本、3と1に2本で、2は足りない・3はちょうど・1は多すぎの、島の3つの姿が並ぶ。
 * 1から出る橋を減らすか、2と3の橋を足せば、本番と同じく完成する。
 *
 * ```text
 * 2.3
 * ...
 * ..1
 * ```
 */
const countBoard = parseBridgesBoard(["2.3", "...", "..1"]);

export const countRuleExamples: BridgesHowToPlayExamplePair = [
  {
    board: countBoard,
    bridges: placeBridges(countBoard, [
      [[0, 0], [0, 2], 2],
      [[0, 2], [2, 2], 1],
    ]),
    hints: [],
  },
  {
    board: countBoard,
    bridges: placeBridges(countBoard, [
      [[0, 0], [0, 2], 1],
      [[0, 2], [2, 2], 2],
    ]),
    hints: [],
  },
];

/**
 * 全部の島をつなげるルール。四隅に2を置いた盤面で、行き先は上下左右の4つ。
 * できる形は4つの辺に1本ずつの輪で、どの島もちょうどで1つにつながった完成の姿。
 * できない形は上と下に2本ずつで、どの島もちょうどなのに、上の2島と下の2島の2組に分かれて閉じた姿。
 *
 * ```text
 * 2.2
 * ...
 * 2.2
 * ```
 */
const connectionBoard = parseBridgesBoard(["2.2", "...", "2.2"]);

export const connectionRuleExamples: BridgesHowToPlayExamplePair = [
  {
    board: connectionBoard,
    bridges: placeBridges(connectionBoard, [
      [[0, 0], [0, 2], 1],
      [[0, 0], [2, 0], 1],
      [[0, 2], [2, 2], 1],
      [[2, 0], [2, 2], 1],
    ]),
    hints: [],
  },
  {
    board: connectionBoard,
    bridges: placeBridges(connectionBoard, [
      [[0, 0], [0, 2], 2],
      [[2, 0], [2, 2], 2],
    ]),
    hints: [],
  },
];

/**
 * 交差のルール。左の1と右の3の間に1本架かり、上の1から下の1への線がその橋と交わる。
 * 上の1から出る線に、架けられるか（右の2へ ✓・下の1へ ✕）の印を付ける。
 * 手がかりは、本番で阻まれる下の1への線に付ける。
 * どの島の数字も、橋が交わらない解（上の1と右の2・右の2と右の3・右の3と左の1・右の3と右下の2・右下の2と下の1に1本ずつ）に
 * 合わせてあり、上の1から右の2へ架けても、2本目を架けるまで多すぎにならない。
 *
 * ```text
 * .1.2
 * ....
 * 1..3
 * ....
 * .1.2
 * ```
 */
const crossingBoard = parseBridgesBoard([
  ".1.2",
  "....",
  "1..3",
  "....",
  ".1.2",
]);

export const crossingRuleExample: BridgesHowToPlayExample = {
  board: crossingBoard,
  bridges: placeBridges(crossingBoard, [[[2, 0], [2, 3], 1]]),
  hints: [{ kind: "edge", edge: findEdge(crossingBoard, [0, 1], [4, 1]) }],
  markedIsland: findIsland(crossingBoard, [0, 1]),
};

/**
 * 操作の例の盤面。左上の3・右上の2・左下の1で、行き先は3と2、3と1の2つ。
 * 3と2の間を回しても、3は足りないままで、多すぎにも完成にもならない。
 *
 * ```text
 * 3.2
 * ...
 * 1..
 * ```
 */
const operationBoard = parseBridgesBoard(["3.2", "...", "1.."]);
const operationEdge = findEdge(operationBoard, [0, 0], [0, 2]);
const operationEmptyBridges = placeBridges(operationBoard, []);

/** 島の間を押すたびに 1本 → 2本 → なし と回る。3回押して、なしに戻るまでを見せる。 */
export const cycleOperationExample: BridgesHowToPlayExample = {
  board: operationBoard,
  bridges: operationEmptyBridges,
  hints: [
    { kind: "edge", edge: operationEdge },
    { kind: "edge", edge: operationEdge },
    { kind: "edge", edge: operationEdge },
  ],
};

/** 右クリックでは なし → 2本 → 1本 と逆に回る。3回押して、なしに戻るまでを見せる。 */
export const backwardCycleOperationExample: BridgesHowToPlayExample = {
  board: operationBoard,
  bridges: operationEmptyBridges,
  hints: [
    { kind: "backward", edge: operationEdge },
    { kind: "backward", edge: operationEdge },
    { kind: "backward", edge: operationEdge },
  ],
};

/**
 * なぞって架ける。左下の3・左上の2・右下の1で、操作の例ごとに盤面を変え、同じ盤面が続かないようにする。
 * 3から上の2へなぞって架ける。架けても、3は足りないままで、多すぎにも完成にもならない。
 *
 * ```text
 * 2..
 * ...
 * 3.1
 * ```
 */
const dragBoard = parseBridgesBoard(["2..", "...", "3.1"]);

export const dragOperationExample: BridgesHowToPlayExample = {
  board: dragBoard,
  bridges: placeBridges(dragBoard, []),
  hints: [
    {
      kind: "drag",
      edge: findEdge(dragBoard, [2, 0], [0, 0]),
      island: findIsland(dragBoard, [2, 0]),
    },
  ],
};

/**
 * 島を選んでから相手の島を押して架ける。左上の1・右上の3・右下の2で、3を押して選び、下の2を押して架ける。
 * 架けても、3は足りないままで、多すぎにも完成にもならない。
 *
 * ```text
 * 1.3
 * ...
 * ..2
 * ```
 */
const pairBoard = parseBridgesBoard(["1.3", "...", "..2"]);

export const pairOperationExample: BridgesHowToPlayExample = {
  board: pairBoard,
  bridges: placeBridges(pairBoard, []),
  hints: [
    { kind: "select", island: findIsland(pairBoard, [0, 2]) },
    {
      kind: "pair",
      edge: findEdge(pairBoard, [0, 2], [2, 2]),
      island: findIsland(pairBoard, [2, 2]),
    },
  ],
};

/**
 * 縦と横の橋が交差する所を押すと、どちらの橋も回さずに2本の線を示す。十字に並んだ4つの島の、縦の線と横の線が交わる真ん中を押させ、
 * 続けて、左の1から右の1へなぞって架けさせる。
 *
 * ```text
 * .1.
 * 1.1
 * .1.
 * ```
 */
const crossingOperationBoard = parseBridgesBoard([".1.", "1.1", ".1."]);

export const crossingOperationExample: BridgesHowToPlayExample = {
  board: crossingOperationBoard,
  bridges: placeBridges(crossingOperationBoard, []),
  hints: [
    {
      kind: "crossing",
      edges: [
        findEdge(crossingOperationBoard, [0, 1], [2, 1]),
        findEdge(crossingOperationBoard, [1, 0], [1, 2]),
      ],
    },
    {
      kind: "drag",
      edge: findEdge(crossingOperationBoard, [1, 0], [1, 2]),
      island: findIsland(crossingOperationBoard, [1, 0]),
    },
  ],
};
