import {
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";

/** 隣の島どうしでも、伸びる途中が目に入る長さ。 */
const EXTEND_BASE_MS = 90;
/** 遠い島へ渡す板ほど長く見せる。 */
const EXTEND_PER_CELL_MS = 15;
/** 長い板でも次の操作を待たせない上限。 */
const EXTEND_MAX_MS = 220;
/** 板が着いてから、浮いていた板の影が沈み切るまでの時間。 */
export const BRIDGE_LANDING_MS = 90;

function getEdgeLength(board: BridgesBoard, edge: number): number {
  const { from, to } = getBridgesNetwork(board).edges[edge]!;
  const start = board.islands[from]!;
  const end = board.islands[to]!;
  return Math.abs(end.row - start.row) + Math.abs(end.column - start.column);
}

/** 盤面の板の動きと、架ける音が同じ時間で揃うよう、ここに置いて両方から使う。 */
export function getBridgeExtendMs(board: BridgesBoard, edge: number): number {
  return Math.min(
    EXTEND_MAX_MS,
    EXTEND_BASE_MS + EXTEND_PER_CELL_MS * getEdgeLength(board, edge),
  );
}
