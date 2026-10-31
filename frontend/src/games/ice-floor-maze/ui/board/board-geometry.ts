import {
  getIceFloorMazeCellPosition,
  type IceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";

/**
 * 盤面は1マスを1単位とする座標で描く。左上のマスの左上が原点。
 * 外壁は盤面の外側を囲む枠で、その太さもマスの単位で表す。
 */
export const ICE_FLOOR_MAZE_WALL_THICKNESS = 0.18;

export type IceFloorMazePoint = { x: number; y: number };

/** マスの中心。 */
export function getIceFloorMazeCellCenter(
  board: IceFloorMazeBoard,
  cellIndex: number,
): IceFloorMazePoint {
  const { x, y } = getIceFloorMazeCellPosition(board, cellIndex);
  return { x: x + 0.5, y: y + 0.5 };
}

/** 外壁を含めた盤面の描画範囲。 */
export function getIceFloorMazeBoardViewBox(
  board: Pick<IceFloorMazeBoard, "width" | "height">,
): { minX: number; minY: number; width: number; height: number } {
  return {
    minX: -ICE_FLOOR_MAZE_WALL_THICKNESS,
    minY: -ICE_FLOOR_MAZE_WALL_THICKNESS,
    width: board.width + ICE_FLOOR_MAZE_WALL_THICKNESS * 2,
    height: board.height + ICE_FLOOR_MAZE_WALL_THICKNESS * 2,
  };
}

/** 向きへ1マス進むときの座標の変化。 */
export const iceFloorMazeDirectionVectors = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
} as const satisfies Record<IceFloorMazeDirection, IceFloorMazePoint>;
