import {
  type BridgesBoard,
  type BridgesDirection,
  type BridgesIsland,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import type { BridgeCount } from "@/games/bridges/puzzle/state";

/**
 * 盤面の上の点。マス幅を 1 とし、左上のマスの左上の角を原点にする。マス (row, column) の中心は (column + 0.5, row + 0.5)。
 * 盤面の描画と押した位置の判定は、どちらもこの座標で行う。
 */
export type BoardPoint = { x: number; y: number };

/** 島の丸の半径。320px 幅の 10×10 でも直径 23px ほどを保ち、1桁の数字が読める大きさ。 */
export const ISLAND_RADIUS = 0.4;

/** 2本の橋の、平行な2線の中心どうしの間隔。 */
export const DOUBLE_BRIDGE_SPACING = 0.2;

/** 島の外を押したとき、線からこの距離までを、その線の辺を押したとみなす。 */
const TAP_REACH = 0.5;

const pointTolerance = 1e-9;

export function getIslandCenter(island: BridgesIsland): BoardPoint {
  return { x: island.column + 0.5, y: island.row + 0.5 };
}

/** 辺の線分。両端は島の丸の縁で、丸の中には線を描かない。 */
export type BoardSegment = { start: BoardPoint; end: BoardPoint };

export function getEdgeSegment(
  board: BridgesBoard,
  edge: number,
): BoardSegment {
  const { from, to, orientation } = getBridgesNetwork(board).edges[edge]!;
  const start = getIslandCenter(board.islands[from]!);
  const end = getIslandCenter(board.islands[to]!);
  return orientation === "horizontal"
    ? {
        start: { x: start.x + ISLAND_RADIUS, y: start.y },
        end: { x: end.x - ISLAND_RADIUS, y: end.y },
      }
    : {
        start: { x: start.x, y: start.y + ISLAND_RADIUS },
        end: { x: end.x, y: end.y - ISLAND_RADIUS },
      };
}

/** 橋の本数ぶんの線を、辺の中心線から横へずらす量。1本は中心線の上、2本は中心線を挟んだ平行な2線。 */
export function getBridgeLineOffsets(count: BridgeCount): readonly number[] {
  if (count === 0) return [];
  return count === 1
    ? [0]
    : [-DOUBLE_BRIDGE_SPACING / 2, DOUBLE_BRIDGE_SPACING / 2];
}

/** 押した位置が指すもの。島の丸の中なら島、島の外で線に近ければ辺。 */
export type BoardTarget =
  | { kind: "island"; island: number }
  | { kind: "edge"; edge: number };

function findIslandAt(board: BridgesBoard, point: BoardPoint): number | null {
  const index = board.islands.findIndex((island) => {
    const center = getIslandCenter(island);
    return (
      Math.hypot(point.x - center.x, point.y - center.y) <=
      ISLAND_RADIUS + pointTolerance
    );
  });
  return index < 0 ? null : index;
}

type EdgeDistance = { edge: number; distance: number };

/** 両端の島の中心の間にある辺と、その中心線までの距離。 */
function listReachableEdges(
  board: BridgesBoard,
  point: BoardPoint,
): EdgeDistance[] {
  return getBridgesNetwork(board).edges.flatMap(
    ({ from, to, orientation }, edge) => {
      const start = getIslandCenter(board.islands[from]!);
      const end = getIslandCenter(board.islands[to]!);
      const [along, across, low, high, line] =
        orientation === "horizontal"
          ? [point.x, point.y, start.x, end.x, start.y]
          : [point.y, point.x, start.y, end.y, start.x];
      const distance = Math.abs(across - line);
      return low < along && along < high && distance <= TAP_REACH
        ? [{ edge, distance }]
        : [];
    },
  );
}

/** 最も近い辺。最も近い辺が2つ以上あれば、押し分けられないので `null`。 */
function findNearestEdge(candidates: readonly EdgeDistance[]): number | null {
  const nearest = Math.min(...candidates.map(({ distance }) => distance));
  const closest = candidates.filter(
    ({ distance }) => distance - nearest <= pointTolerance,
  );
  return closest.length === 1 ? closest[0]!.edge : null;
}

/**
 * 押した位置が指す島か辺。島の丸の中なら島。島の外なら、線から半マスまでの辺のうち最も近いもの。
 * 交わる2辺の近くを押したときは、片方にだけ橋があれば橋のある方を選ぶ。橋の無い方は交わる橋に阻まれて架けられないので、
 * 架かった橋を回す操作を取らせない。どちらにも橋が無ければ最も近い線、つまり交点からの対角線で分けた区画の線を選ぶ。
 */
export function findBoardTarget(
  board: BridgesBoard,
  bridges: readonly BridgeCount[],
  point: BoardPoint,
): BoardTarget | null {
  const island = findIslandAt(board, point);
  if (island !== null) {
    return { kind: "island", island };
  }
  const { crossingEdges } = getBridgesNetwork(board);
  const candidates = listReachableEdges(board, point);
  const bridgedCandidates = new Set(
    candidates.flatMap(({ edge }) => (bridges[edge] === 0 ? [] : [edge])),
  );
  const selectable = candidates.filter(
    ({ edge }) =>
      bridges[edge] !== 0 ||
      !crossingEdges[edge]!.some((crossing) => bridgedCandidates.has(crossing)),
  );
  const edge = findNearestEdge(selectable);
  return edge === null ? null : { kind: "edge", edge };
}

/** 島からなぞった指が、島の丸の外へ出たか。 */
export function hasLeftIsland(
  board: BridgesBoard,
  island: number,
  point: BoardPoint,
): boolean {
  const center = getIslandCenter(board.islands[island]!);
  return Math.hypot(point.x - center.x, point.y - center.y) > ISLAND_RADIUS;
}

/** 島の中心から指への向き。縦横のうち、離れた量の大きい方の向きにする。 */
export function findDragDirection(
  board: BridgesBoard,
  island: number,
  point: BoardPoint,
): BridgesDirection {
  const center = getIslandCenter(board.islands[island]!);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "down" : "up";
}
