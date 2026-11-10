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

/** 島の陸の半径。320px 幅の 10×10 でも直径 23px ほどを保ち、1桁の数字が読める大きさ。 */
export const ISLAND_RADIUS = 0.4;

/**
 * 外周の島のマスの縁から絵の縁までの海の幅。外周の島の陸から絵の縁まで半マスほどの海を残し、島が縁に詰まって見えないようにする。
 * 画面端から始まるタッチはブラウザの戻る操作に取られるので、この海が外周の島を画面端から離す余白も兼ねる。
 */
export const BOARD_MARGIN = 0.4;

/**
 * 縦長の画面で、盤面の枠の高さを幅の何倍まで伸ばすか。枠が縦に伸びた分だけ行の間隔を広げる（`fitBoardView`）。
 * スマホでは盤面の上下に高さが余るので、行の間を広げて縦に並ぶ橋と上下の行の横の橋を押し分けやすくする。
 * 格子は描かないので、行の間が広がっても島の並びとしてしか見えない。
 */
export const MAXIMUM_BOARD_HEIGHT_RATIO = 1.4;

/**
 * 盤面を描く絵の座標。マス幅を 1 とし、盤面の周りに `BOARD_MARGIN` の海を置き、行の間隔を `pitch` 倍にする。
 * - `width`・`height`: 絵の幅と高さ（`viewBox` の大きさ）。
 */
export type BoardView = {
  board: BridgesBoard;
  pitch: number;
  width: number;
  height: number;
};

export function createBoardView(board: BridgesBoard, pitch = 1): BoardView {
  return {
    board,
    pitch,
    width: board.width + 2 * BOARD_MARGIN,
    height: board.height * pitch + 2 * BOARD_MARGIN,
  };
}

/** 盤面を描いた枠の、画面上の位置と大きさ。 */
export type BoardFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** 枠の縦横比に絵がちょうど収まる行の間隔で、絵の座標を作る。枠が横長なら行の間隔を広げない。 */
export function fitBoardView(
  board: BridgesBoard,
  frame: Pick<BoardFrame, "width" | "height">,
): BoardView {
  if (frame.width <= 0 || frame.height <= 0) {
    return createBoardView(board);
  }
  const viewWidth = board.width + 2 * BOARD_MARGIN;
  const pitch =
    ((frame.height / frame.width) * viewWidth - 2 * BOARD_MARGIN) /
    board.height;
  return createBoardView(board, Math.max(1, pitch));
}

export function toViewPoint(view: BoardView, { x, y }: BoardPoint): BoardPoint {
  return { x: x + BOARD_MARGIN, y: y * view.pitch + BOARD_MARGIN };
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
    x: viewX - BOARD_MARGIN,
    y: (viewY - BOARD_MARGIN) / view.pitch,
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

/** 押した点が、辺の両端の島の陸の間で橋の線に沿った帯の中にあるか。チュートリアルで押させる辺の押しの範囲に使う。 */
export function isPointInEdgeBand(
  board: BridgesBoard,
  edge: number,
  { x, y }: BoardPoint,
): boolean {
  const { from, to } = getBridgesNetwork(board).edges[edge]!;
  const band = getBand(
    getIslandCenter(board.islands[from]!),
    getIslandCenter(board.islands[to]!),
    EDGE_BAND_WIDTH,
  );
  return (
    x >= band.x &&
    x <= band.x + band.width &&
    y >= band.y &&
    y <= band.y + band.height
  );
}

/** 辺の帯を絵の座標で返す。チュートリアルの印と、覆いから抜く所を辺に沿わせるのに使う。 */
export function getEdgeViewBand(view: BoardView, edge: number): BoardRect {
  const { start, end } = getEdgeViewSegment(view, edge);
  return getBand(start, end, EDGE_BAND_WIDTH);
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
const DOUBLE_BRIDGE_SPACING = 0.27;

/** 橋の本数ぶんの板を、辺の中心線から横へずらす量。1本は中心線の上、2本は中心線を挟んだ平行な2枚。 */
export function getBridgeLineOffsets(count: BridgeCount): readonly number[] {
  if (count === 0) return [];
  return count === 1
    ? [0]
    : [-DOUBLE_BRIDGE_SPACING / 2, DOUBLE_BRIDGE_SPACING / 2];
}

/** 押した位置が指すもの。島の近くなら島、島の外で線に近ければ辺。 */
export type BoardTarget =
  | { kind: "island"; island: number }
  | { kind: "edge"; edge: number };

/**
 * 島を押したとみなす、島の中心からの距離。島は上下左右に隣り合わないので、陸より広く半マスまでを島の的にしても隣の島の的と重ならない。
 */
const ISLAND_REACH = 0.5;

/** 島の外を押したとき、線からこの距離までを、その線の辺を押したとみなす。 */
const TAP_REACH = 0.5;

const pointTolerance = 1e-9;

/** `islands` のうち、`point` から `reach` の内で最も近い島。 */
function findIslandNear(
  board: BridgesBoard,
  point: BoardPoint,
  reach: number,
  islands: readonly number[] = board.islands.map((_, index) => index),
): number | null {
  let nearest: number | null = null;
  let nearestDistance = reach + pointTolerance;
  for (const index of islands) {
    const center = getIslandCenter(board.islands[index]!);
    const distance = Math.hypot(point.x - center.x, point.y - center.y);
    if (distance <= nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/**
 * 島の外を押した点から見た、1つの候補の辺。
 * - `distance`: 線（2島の中心を結ぶ線）までの距離。
 * - `midpointOffset`: 2島の間の真ん中からの、線に沿ったずれを、真ん中から島の中心までの長さで割った値（真ん中で 0、島の中心で 1）。
 * - `midpointDistance`: 2島の間の真ん中までの距離。
 * - `span`: 2島の中心の間の長さ。
 */
type EdgeCandidate = {
  edge: number;
  distance: number;
  midpointOffset: number;
  midpointDistance: number;
  span: number;
};

/**
 * 交わる2辺の交点の近くで、線までの距離の差がこれ以下なら、人はどちらの線を狙ったか距離では分からないとみなし、
 * 距離のほかの手がかりで選ぶ。人は「つなぎたい2島の間の真ん中」を押すので、短い辺の真ん中が長い辺の上に乗る所で、
 * 最も近い線だけでは狙いと違う辺を選ぶ。値は、問題集の盤面で真ん中を狙う押し方と、交点を避けて線を狙う押し方を
 * 指のぶれ付きで模した比較で、前者の当たりが上がり、後者の当たりがほとんど落ちない所に置いた。
 */
const CROSSING_AMBIGUITY = 0.15;

/**
 * 交わる2辺の真ん中がどちらもこの距離の内にあれば、真ん中が重なっているとみなし、短い辺を選ぶ。
 * 真ん中が重なる所では、真ん中からのずれは指のぶれでしか決まらないので、いつも同じ辺を選んで予測できるようにする。
 * 長い辺は、交点を避けた所を押すかなぞって架ける。
 */
const SHARED_MIDPOINT_RADIUS = 0.15;

/**
 * 真ん中からのずれ（`midpointOffset`）の差がこれ以下なら、どちらの2島の間の真ん中を押したかでは選べないとみなし、
 * 直前に触った島で選ぶ。
 */
const MIDPOINT_MARGIN = 0.1;

/** 両端の島の中心の間にあり、線から `TAP_REACH` までの辺。 */
function listReachableEdges(
  board: BridgesBoard,
  point: BoardPoint,
): EdgeCandidate[] {
  return getBridgesNetwork(board).edges.flatMap(
    ({ from, to, orientation }, edge) => {
      const start = getIslandCenter(board.islands[from]!);
      const end = getIslandCenter(board.islands[to]!);
      const [along, across, low, high, line] =
        orientation === "horizontal"
          ? [point.x, point.y, start.x, end.x, start.y]
          : [point.y, point.x, start.y, end.y, start.x];
      const distance = Math.abs(across - line);
      const halfSpan = (high - low) / 2;
      const alongOffset = Math.abs(along - (low + halfSpan));
      return low < along && along < high && distance <= TAP_REACH
        ? [
            {
              edge,
              distance,
              midpointOffset: alongOffset / halfSpan,
              midpointDistance: Math.hypot(alongOffset, distance),
              span: high - low,
            },
          ]
        : [];
    },
  );
}

/** 最後の決め手。真ん中に近い、短い、線に近い、番号の小さい順。 */
function compareForFallback(left: EdgeCandidate, right: EdgeCandidate) {
  return (
    left.midpointOffset - right.midpointOffset ||
    left.span - right.span ||
    left.distance - right.distance ||
    left.edge - right.edge
  );
}

/**
 * 押した点の近くの辺から1つを選ぶための、盤面の手がかり。
 * - `recentIslands`: 直前に触った島。直前に押した島と、直前に橋を回した辺の両端。
 */
type EdgeSelectionContext = {
  crossingEdges: readonly (readonly number[])[];
  edgeIslands: readonly (readonly [number, number])[];
  bridges: readonly BridgeCount[];
  recentIslands: readonly number[];
};

/**
 * 押した点が指す辺。線が最も近い辺を選び、それと見分けにくい辺（交わる辺で線までの距離の差が `CROSSING_AMBIGUITY` 以下のもの、
 * または同じ距離の辺）があれば、次の順で1つに決める。押した所で何も起きない空振りを作らない。
 * 1. 交わる2辺の片方にだけ橋があれば、橋の無い方。架けようとすると阻まれるので、盤面を変えずに阻んだ橋を光らせて返し、
 *    狙いと違う橋を増やしたり外したりしない。
 * 2. 2辺の真ん中が重なっていれば短い辺、そうでなければ2島の間の真ん中にはっきり近い辺。
 * 3. 直前に触った島から伸びる辺。島の周りを続けて架けていく流れに沿わせる。
 * 4. それでも決まらなければ `compareForFallback` の順。
 */
function selectEdge(
  candidates: readonly EdgeCandidate[],
  { crossingEdges, edgeIslands, bridges, recentIslands }: EdgeSelectionContext,
): number {
  const nearestDistance = Math.min(
    ...candidates.map(({ distance }) => distance),
  );
  const closest = candidates.filter(
    ({ distance }) => distance - nearestDistance <= pointTolerance,
  );
  let contenders = candidates.filter(
    (candidate) =>
      closest.includes(candidate) ||
      (candidate.distance - nearestDistance <= CROSSING_AMBIGUITY &&
        closest.some(({ edge }) =>
          crossingEdges[edge]!.includes(candidate.edge),
        )),
  );
  const blockedByContender = contenders.filter(
    (candidate) =>
      bridges[candidate.edge] === 0 &&
      contenders.some(
        (other) =>
          bridges[other.edge] !== 0 &&
          crossingEdges[candidate.edge]!.includes(other.edge),
      ),
  );
  if (blockedByContender.length > 0) {
    contenders = blockedByContender;
  }
  const atSharedMidpoint = contenders.filter(
    ({ midpointDistance }) => midpointDistance <= SHARED_MIDPOINT_RADIUS,
  );
  if (atSharedMidpoint.length >= 2) {
    const shortest = Math.min(...atSharedMidpoint.map(({ span }) => span));
    contenders = atSharedMidpoint.filter(
      ({ span }) => span - shortest <= pointTolerance,
    );
  } else {
    const nearestMidpoint = Math.min(
      ...contenders.map(({ midpointOffset }) => midpointOffset),
    );
    contenders = contenders.filter(
      ({ midpointOffset }) =>
        midpointOffset - nearestMidpoint <= MIDPOINT_MARGIN,
    );
  }
  const fromRecentIslands = contenders.filter(({ edge }) =>
    edgeIslands[edge]!.some((island) => recentIslands.includes(island)),
  );
  if (fromRecentIslands.length > 0) {
    contenders = fromRecentIslands;
  }
  return [...contenders].sort(compareForFallback)[0]!.edge;
}

/**
 * 押した位置が指す島か辺。島の中心から `ISLAND_REACH` の内なら島。島の外なら、線から `TAP_REACH` までの辺から `selectEdge` で選ぶ。
 * 選んだ辺が交わる橋に阻まれていても、そのまま返す（架けようとして阻まれたことを盤面で返す）。どの線からも遠ければ `null`。
 */
export function findBoardTarget(
  board: BridgesBoard,
  bridges: readonly BridgeCount[],
  point: BoardPoint,
  recentIslands: readonly number[] = [],
): BoardTarget | null {
  const island = findIslandNear(board, point, ISLAND_REACH);
  if (island !== null) {
    return { kind: "island", island };
  }
  const candidates = listReachableEdges(board, point);
  if (candidates.length === 0) {
    return null;
  }
  const { edges, crossingEdges } = getBridgesNetwork(board);
  return {
    kind: "edge",
    edge: selectEdge(candidates, {
      crossingEdges,
      edgeIslands: edges.map(({ from, to }) => [from, to] as const),
      bridges,
      recentIslands,
    }),
  };
}

/** 押した点が、島 `island` を押したとみなす範囲にあるか。 */
export function isPointOnIsland(
  board: BridgesBoard,
  island: number,
  point: BoardPoint,
): boolean {
  return findIslandNear(board, point, ISLAND_REACH, [island]) !== null;
}

/**
 * なぞって離した点を、相手の島で離したとみなす、相手の島の中心からの距離。島の的より広くし、指が相手の島に届けば確定させ、
 * 途中で離した軽い接触は確定させない。
 */
const DRAG_RELEASE_REACH = 0.75;

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
 * 島 `island` からなぞって `point` で離したときに橋を回す辺。相手の島（`island` から辺の伸びる島）の中心から
 * `DRAG_RELEASE_REACH` の内で離したときだけ、最も近い相手の島への辺を返す。それ以外は `null`。
 */
export function findDragEdge(
  board: BridgesBoard,
  island: number,
  point: BoardPoint,
): number | null {
  const neighbors = listNeighbors(board, island);
  const released = findIslandNear(
    board,
    point,
    DRAG_RELEASE_REACH,
    neighbors.map(({ neighbor }) => neighbor),
  );
  return released === null
    ? null
    : (neighbors.find(({ neighbor }) => neighbor === released)?.edge ?? null);
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
