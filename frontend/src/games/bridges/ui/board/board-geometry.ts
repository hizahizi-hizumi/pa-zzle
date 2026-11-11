import {
  type BridgesBoard,
  type BridgesDirection,
  type BridgesIsland,
  findBridgesEdgeToward,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import type { BridgeCount } from "@/games/bridges/puzzle/state";

/**
 * 盤面の上の点。マス幅を 1 とし、左上のマスの左上の角を原点にする。マス (row, column) の中心は (column + 0.5, row + 0.5)。
 * 押した位置の判定はこの座標で行い、描くときは `toViewPoint` で絵の座標へ写す。
 */
export type BoardPoint = { x: number; y: number };

/**
 * 島の陸の半径（輪郭を揺らす前の値）。マスの間隔の9割近くまで陸を広げ、390px 幅の 10×10 でも直径 30px ほど、数字 18px ほどを保つ。
 * 島は上下左右に隣り合わないので、斜めに隣り合う島（中心の間 1.41）とも陸は重ならない。
 */
export const ISLAND_RADIUS = 0.44;

/**
 * 外周の島のマスの縁から絵の縁までの海の幅。外周の島の陸から絵の縁まで半マスほどの海を残し、島が縁に詰まって見えないようにする。
 * 画面端から始まるタッチはブラウザの戻る操作に取られるので、この海が外周の島を画面端から離す余白も兼ねる。
 */
export const BOARD_MARGIN = 0.4;

/**
 * 9×9 以上の盤面の海の幅。390px 幅のスマホでマスが小さくなる盤面では、余白を詰めて島を大きく描く。
 * 外周の島の陸は、画面の左右の余白と陸の周りのマスの残りと合わせて、画面端から 12px ほど離れる。
 */
export const WIDE_BOARD_MARGIN = 0.12;
const WIDE_BOARD_SIDE = 9;

/**
 * 盤面を描く絵の座標。マス幅を 1 とした正方形のマスで、盤面の周りに `margin` の海を置く。
 * - `margin`: 盤面の周りの海の幅。
 * - `width`・`height`: 絵の幅と高さ（`viewBox` の大きさ）。
 */
export type BoardView = {
  board: BridgesBoard;
  margin: number;
  width: number;
  height: number;
};

export function createBoardView(board: BridgesBoard): BoardView {
  const margin =
    Math.max(board.width, board.height) >= WIDE_BOARD_SIDE
      ? WIDE_BOARD_MARGIN
      : BOARD_MARGIN;
  return {
    board,
    margin,
    width: board.width + 2 * margin,
    height: board.height + 2 * margin,
  };
}

/** 盤面を描いた枠の、画面上の位置と大きさ。 */
export type BoardFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function toViewPoint(
  { margin }: BoardView,
  { x, y }: BoardPoint,
): BoardPoint {
  return { x: x + margin, y: y + margin };
}

/** 画面上の点（`clientX`・`clientY`）を盤面の座標へ写す。 */
export function toBoardPoint(
  view: BoardView,
  frame: BoardFrame,
  clientX: number,
  clientY: number,
): BoardPoint {
  const viewX = ((clientX - frame.left) / frame.width) * view.width;
  const viewY = ((clientY - frame.top) / frame.height) * view.height;
  return {
    x: viewX - view.margin,
    y: viewY - view.margin,
  };
}

export function getIslandCenter(island: BridgesIsland): BoardPoint {
  return { x: island.column + 0.5, y: island.row + 0.5 };
}

/** 2点を結ぶ線分。 */
export type BoardSegment = { start: BoardPoint; end: BoardPoint };

/** 辺の両端の島の中心を、絵の座標で結ぶ線分。橋は島の陸の下に描くので、線分の端は陸に隠れる。 */
export function getEdgeViewSegment(
  view: BoardView,
  edge: number,
): BoardSegment {
  const { from, to } = getBridgesNetwork(view.board).edges[edge]!;
  return {
    start: toViewPoint(view, getIslandCenter(view.board.islands[from]!)),
    end: toViewPoint(view, getIslandCenter(view.board.islands[to]!)),
  };
}

/** 盤面の上の四角。 */
export type BoardRect = { x: number; y: number; width: number; height: number };

/** 辺の帯の太さ。2本の橋の2枚の板を収め、島の陸より細くして、どの2島の間かを読めるようにする。 */
const EDGE_BAND_WIDTH = 0.5;

/** 両端の島の陸の縁から縁までを、`thickness` の太さで線に沿わせた帯。`from`・`to` は線の両端（島の中心）。 */
function getBand(
  from: BoardPoint,
  to: BoardPoint,
  thickness: number,
): BoardRect {
  const half = thickness / 2;
  return from.y === to.y
    ? {
        x: from.x + ISLAND_RADIUS,
        y: from.y - half,
        width: to.x - from.x - 2 * ISLAND_RADIUS,
        height: thickness,
      }
    : {
        x: from.x - half,
        y: from.y + ISLAND_RADIUS,
        width: thickness,
        height: to.y - from.y - 2 * ISLAND_RADIUS,
      };
}

/**
 * 押した点が、辺の両端の島の陸の間で、線の当たり範囲と同じ幅の帯の中にあるか。チュートリアルで押させる辺の押しの範囲に使う。
 */
export function isPointInEdgeBand(
  board: BridgesBoard,
  edge: number,
  { x, y }: BoardPoint,
): boolean {
  const { from, to } = getBridgesNetwork(board).edges[edge]!;
  const band = getBand(
    getIslandCenter(board.islands[from]!),
    getIslandCenter(board.islands[to]!),
    LINE_HIT_HALF_WIDTH * 2,
  );
  return (
    x >= band.x &&
    x <= band.x + band.width &&
    y >= band.y &&
    y <= band.y + band.height
  );
}

/**
 * 辺の帯を絵の座標で返す。覆いから抜く所と、チュートリアルの印を辺に沿わせるのに使う。
 * `thickness` を渡すとその太さにし、渡さなければ2本の橋の2枚の板を収める太さにする。
 */
export function getEdgeViewBand(
  view: BoardView,
  edge: number,
  thickness = EDGE_BAND_WIDTH,
): BoardRect {
  const { start, end } = getEdgeViewSegment(view, edge);
  return getBand(start, end, thickness);
}

/** 島の陸を囲む四角を絵の座標で返す。 */
export function getIslandViewRect(view: BoardView, island: number): BoardRect {
  const { x, y } = toViewPoint(
    view,
    getIslandCenter(view.board.islands[island]!),
  );
  return {
    x: x - ISLAND_RADIUS,
    y: y - ISLAND_RADIUS,
    width: ISLAND_RADIUS * 2,
    height: ISLAND_RADIUS * 2,
  };
}

/** 2本の橋の、平行な2枚の板の中心どうしの間隔。2枚の間に海が見え、1本と2本を形で見分けられる幅にする。 */
export const DOUBLE_BRIDGE_SPACING = 0.3;

/**
 * 橋の本数ぶんの板を、辺の中心線から横へずらす量。1本は中心線の上、2本は中心線を挟んだ平行な2枚。
 * `spacing` は2枚の板の中心どうしの間隔（マス幅を 1 とした値）。
 */
export function getBridgeLineOffsets(
  count: BridgeCount,
  spacing = DOUBLE_BRIDGE_SPACING,
): readonly number[] {
  if (count === 0) return [];
  return count === 1 ? [0] : [-spacing / 2, spacing / 2];
}

/**
 * 押した位置が指すもの。
 * - `island`: 島の陸の上。
 * - `edge`: 島の外で、その辺の線の当たり範囲にあり、ほかの線より明らかに近い所。その辺の橋を回す。
 * - `ambiguous`: 島の外で、最も近い2本の線までの距離がほとんど同じ所（交点のそばや、1つの島から出る縦と横の線の間）。
 *   どちらを狙ったかを位置で決められないので、どちらの橋も回さず、2辺を候補として示す。`edges` は辺の番号の小さい順。
 */
export type BoardTarget =
  | { kind: "island"; island: number }
  | { kind: "edge"; edge: number }
  | { kind: "ambiguous"; edges: readonly [number, number] };

/**
 * 島を押したとみなす、島の中心からの距離。陸の半径（輪郭の揺らぎで最大 `ISLAND_RADIUS × 1.08`）に波打ち際の泡の幅を足した所までにし、
 * 陸の外の水面は島の的にしない。斜めに隣り合う島（中心の間 1.41）の的は、2島の間の線から半マス離れた所で止まり、線の当たり範囲と
 * 重ならない。
 */
export const ISLAND_HIT_RADIUS = 0.5;

/**
 * 線の当たり範囲の、線から片側の幅。2島の中心の間で、線から両側にこの幅までの長方形を、その辺の線の当たり範囲にする。
 * 隣の行・列の平行な線の範囲と、真ん中で接する。
 */
export const LINE_HIT_HALF_WIDTH = 0.5;

/** 最も近い2本の線までの距離の差がこれより小さいと、どちらの線かを位置で決めない。交点の中心から片側 0.1 マスほどの帯になる。 */
export const AMBIGUOUS_DISTANCE_GAP = 0.2;

const pointTolerance = 1e-9;

/** 島の中心からの距離。 */
function distanceToIsland(
  board: BridgesBoard,
  island: number,
  point: BoardPoint,
): number {
  const center = getIslandCenter(board.islands[island]!);
  return Math.hypot(point.x - center.x, point.y - center.y);
}

/** `islands` のうち、`point` を陸の上に含む島（中心から `ISLAND_HIT_RADIUS` の内）。2つの島に入るときは中心の近い島。 */
function findIslandNear(
  board: BridgesBoard,
  point: BoardPoint,
  islands: readonly number[] = board.islands.map((_, index) => index),
): number | null {
  let nearest: number | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const index of islands) {
    const distance = distanceToIsland(board, index, point);
    if (
      distance <= ISLAND_HIT_RADIUS + pointTolerance &&
      distance < nearestDistance
    ) {
      nearest = index;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/** 押した点を当たり範囲に含む線の辺と、線までの垂直な距離。距離の近い順。 */
function listLinesInRange(
  board: BridgesBoard,
  point: BoardPoint,
): { edge: number; distance: number }[] {
  return getBridgesNetwork(board)
    .edges.flatMap(({ from, to, orientation }, edge) => {
      const start = getIslandCenter(board.islands[from]!);
      const end = getIslandCenter(board.islands[to]!);
      const [along, across, low, high, line] =
        orientation === "horizontal"
          ? [point.x, point.y, start.x, end.x, start.y]
          : [point.y, point.x, start.y, end.y, start.x];
      const distance = Math.abs(across - line);
      return low < along &&
        along < high &&
        distance <= LINE_HIT_HALF_WIDTH + pointTolerance
        ? [{ edge, distance }]
        : [];
    })
    .sort(
      (left, right) => left.distance - right.distance || left.edge - right.edge,
    );
}

/**
 * 押した位置が指す島か辺。
 * - 島の陸の上（中心から `ISLAND_HIT_RADIUS` の内）なら島。
 * - 島の外では、押した点を当たり範囲（2島の中心の間で、線から両側に `LINE_HIT_HALF_WIDTH` までの長方形）に含む線のうち、
 *   線までの垂直な距離が最も近い線の辺。架かった橋もそこを押せば回る。交わる別の橋に阻まれていても、そのまま返す
 *   （架けようとして阻まれたことを盤面で返す）。
 * - 最も近い2本の線までの距離の差が `AMBIGUOUS_DISTANCE_GAP` より小さければ、どちらの辺にも決めない（`ambiguous`）。
 * - どの線の当たり範囲にも入らなければ `null`。
 */
export function findBoardTarget(
  board: BridgesBoard,
  point: BoardPoint,
): BoardTarget | null {
  const island = findIslandNear(board, point);
  if (island !== null) {
    return { kind: "island", island };
  }
  const [nearest, second] = listLinesInRange(board, point);
  if (nearest === undefined) {
    return null;
  }
  if (
    second !== undefined &&
    second.distance - nearest.distance < AMBIGUOUS_DISTANCE_GAP
  ) {
    const [first, last] = [nearest.edge, second.edge].sort(
      (left, right) => left - right,
    );
    return { kind: "ambiguous", edges: [first!, last!] };
  }
  return { kind: "edge", edge: nearest.edge };
}

/** 押した点が、島 `island` の陸の上にあるか。 */
export function isPointOnIsland(
  board: BridgesBoard,
  island: number,
  point: BoardPoint,
): boolean {
  return findIslandNear(board, point, [island]) !== null;
}

/** 島 `island` から辺の伸びる相手の島と、その辺。 */
function listNeighbors(
  board: BridgesBoard,
  island: number,
): { neighbor: number; edge: number }[] {
  const { edges, islandEdges } = getBridgesNetwork(board);
  return islandEdges[island]!.map((edge) => {
    const { from, to } = edges[edge]!;
    return { neighbor: from === island ? to : from, edge };
  });
}

/** 島 `island` と島 `other` の間の辺。辺が無ければ `null`。 */
export function findEdgeBetween(
  board: BridgesBoard,
  island: number,
  other: number,
): number | null {
  return (
    listNeighbors(board, island).find(({ neighbor }) => neighbor === other)
      ?.edge ?? null
  );
}

/**
 * なぞりを縦横の向きとして受ける、縦横からの角度の幅。斜めのなぞりで、どちらの向きの橋か分からないまま架けない。
 */
const DRAG_ANGLE_TOLERANCE = (25 * Math.PI) / 180;

/**
 * なぞって離した所を相手の島に届いたとみなす、相手の島の中心からの縦横の幅。島を押したとみなす範囲より少し広くし、
 * 指で隠れた島の縁で離しても届いたとする。相手の島を通り過ぎて離したときも、線から外れていなければ届いたとする。
 */
const DRAG_LANDING_REACH = 0.7;

/**
 * なぞっている指の狙い。
 * - `edge`: 指の向きの最初の島への辺。
 * - `landed`: 今離せば `edge` の橋を回すか。指が相手の島に届く前は `false`。
 */
export type DragAim = { edge: number; landed: boolean };

/**
 * 島 `island` からなぞって `point` まで指を動かしたときの狙い。指が島の陸（`ISLAND_HIT_RADIUS`）を出て、縦横から
 * `DRAG_ANGLE_TOLERANCE` の内へ動いたら、その向きの最初の島への辺を狙う。離して回すのは、指が相手の島に届いた
 * （`DRAG_LANDING_REACH`）ときだけにし、海の上で止めたなぞりでは回さない。
 * 指が島の的の内にあるか、斜めに動いたか、その向きに辺が無ければ `null`。
 */
export function findDragAim(
  board: BridgesBoard,
  island: number,
  point: BoardPoint,
): DragAim | null {
  const center = getIslandCenter(board.islands[island]!);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  if (Math.hypot(dx, dy) <= ISLAND_HIT_RADIUS) {
    return null;
  }
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const along = horizontal ? Math.abs(dx) : Math.abs(dy);
  const across = horizontal ? Math.abs(dy) : Math.abs(dx);
  if (Math.atan2(across, along) > DRAG_ANGLE_TOLERANCE) {
    return null;
  }
  const direction: BridgesDirection = horizontal
    ? dx > 0
      ? "right"
      : "left"
    : dy > 0
      ? "down"
      : "up";
  const edge = findBridgesEdgeToward(board, island, direction);
  if (edge === null) {
    return null;
  }
  const { from, to } = getBridgesNetwork(board).edges[edge]!;
  const target = getIslandCenter(board.islands[from === island ? to : from]!);
  const span = Math.hypot(target.x - center.x, target.y - center.y);
  return {
    edge,
    landed: along >= span - DRAG_LANDING_REACH && across <= DRAG_LANDING_REACH,
  };
}

const directionVectors = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
} as const satisfies Record<BridgesDirection, BoardPoint>;

/**
 * キーボードで `direction` の向きへ移るときの、次の島。その向きに辺のある島があればその島、無ければ、その向きにある島のうち
 * 向きに沿った距離と横へのずれの2倍の和が最も小さい島。その向きに島が無ければ `null`。
 */
export function findIslandToward(
  board: BridgesBoard,
  island: number,
  direction: BridgesDirection,
): number | null {
  const edge = findBridgesEdgeToward(board, island, direction);
  if (edge !== null) {
    const { from, to } = getBridgesNetwork(board).edges[edge]!;
    return from === island ? to : from;
  }
  const origin = board.islands[island]!;
  const vector = directionVectors[direction];
  let best: number | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const [index, other] of board.islands.entries()) {
    const dx = other.column - origin.column;
    const dy = other.row - origin.row;
    const along = dx * vector.x + dy * vector.y;
    if (along <= 0) {
      continue;
    }
    const score = along + 2 * Math.abs(dx * vector.y + dy * vector.x);
    if (score < bestScore) {
      best = index;
      bestScore = score;
    }
  }
  return best;
}
