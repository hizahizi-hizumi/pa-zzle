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
 * 島の真円の半径（輪郭線の中心まで）。マスの間隔の9割余りまで広げ、390px 幅の 10×10 でも輪郭線の外まで直径 35px ほど、数字 20px ほどを保つ。
 * 島は上下左右に隣り合わないので、斜めに隣り合う島（中心の間 1.41）とも重ならない。
 */
export const ISLAND_RADIUS = 0.46;

/**
 * 外周の島のマスの縁から絵の縁までの海の幅。外周の島の陸から絵の縁まで半マスほどの海を残し、島が縁に詰まって見えないようにする。
 * 画面端から始まるタッチはブラウザの戻る操作に取られるので、この海が外周の島を画面端から離す余白も兼ねる。
 */
export const BOARD_MARGIN = 0.4;

/**
 * 9×9 以上の盤面の海の幅。390px 幅のスマホでマスが小さくなる盤面では、余白を詰めて島を大きく描く。
 * 外周の島の陸は、画面の左右の余白と陸の周りのマスの残りと合わせて、画面端から 16px 以上離れる。
 */
export const WIDE_BOARD_MARGIN = 0.2;
const WIDE_BOARD_SIDE = 9;

/**
 * 盤面を描く絵の座標。マス幅を 1 とした正方形のマスで、盤面の周りに `margin` の海を置く。
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

export type BoardSegment = { start: BoardPoint; end: BoardPoint };

/** 橋は島の陸の下に描くので、線分の端は陸に隠れる。 */
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

export function getEdgeViewBand(
  view: BoardView,
  edge: number,
  thickness = EDGE_BAND_WIDTH,
): BoardRect {
  const { start, end } = getEdgeViewSegment(view, edge);
  return getBand(start, end, thickness);
}

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
 * 橋の本数ぶんの板を、辺の中心線から横へずらす量。
 * `spacing` は2枚の板の中心どうしの間隔（マス幅を 1 とした値）。
 */
export function getBridgeLineOffsets(
  count: BridgeCount,
  spacing = DOUBLE_BRIDGE_SPACING,
): readonly number[] {
  if (count === 0) return [];
  return count === 1 ? [0] : [-spacing / 2, spacing / 2];
}

export type BoardTarget =
  | { kind: "island"; island: number }
  | { kind: "edge"; edge: number }
  | { kind: "ambiguous"; ascendingEdges: readonly [number, number] };

/**
 * 描いた島の半径（`ISLAND_RADIUS` に輪郭線の外側の半分を足した所）とほぼ同じにする。斜めに隣り合う島（中心の間 1.41）の的は、2島の間の線から半マス離れた所で止まり、線の当たり範囲と
 * 重ならない。
 */
export const ISLAND_HIT_RADIUS = 0.5;

/** 隣の行・列の平行な線の範囲と、真ん中で接する。 */
export const LINE_HIT_HALF_WIDTH = 0.5;

/** 最も近い2本の線までの距離の差がこれより小さいと、どちらの線かを位置で決めない。交点の中心から片側 0.1 マスほどの帯になる。 */
export const AMBIGUOUS_DISTANCE_GAP = 0.2;

const pointTolerance = 1e-9;

function distanceToIsland(
  board: BridgesBoard,
  island: number,
  point: BoardPoint,
): number {
  const center = getIslandCenter(board.islands[island]!);
  return Math.hypot(point.x - center.x, point.y - center.y);
}

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

/** 交わる別の橋に阻まれていても辺をそのまま返す（架けようとして阻まれたことを盤面で返す）。 */
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
    return { kind: "ambiguous", ascendingEdges: [first!, last!] };
  }
  return { kind: "edge", edge: nearest.edge };
}

export function isPointOnIsland(
  board: BridgesBoard,
  island: number,
  point: BoardPoint,
): boolean {
  return findIslandNear(board, point, [island]) !== null;
}

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

const DRAG_ANGLE_TOLERANCE = (25 * Math.PI) / 180;

/**
 * なぞって離した所を相手の島に届いたとみなす、相手の島の中心からの縦横の幅。島を押したとみなす範囲より少し広くし、
 * 指で隠れた島の縁で離しても届いたとする。相手の島を通り過ぎて離したときも、線から外れていなければ届いたとする。
 */
const DRAG_LANDING_REACH = 0.7;

/** `cyclesOnRelease` は、指が相手の島に届く前は `false`。 */
export type DragAim = { edge: number; cyclesOnRelease: boolean };

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
    cyclesOnRelease:
      along >= span - DRAG_LANDING_REACH && across <= DRAG_LANDING_REACH,
  };
}

const directionVectors = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
} as const satisfies Record<BridgesDirection, BoardPoint>;

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
