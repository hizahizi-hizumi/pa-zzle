import type {
  IceFloorMazeBoard,
  IceFloorMazeCell,
} from "@/games/ice-floor-maze/puzzle/board";

/** 解いている途中の盤面のマス。初期盤面のマスに、薄い氷が割れた後の水面（`water`。止め役）を足したもの。 */
export type IceFloorMazeStateCell = IceFloorMazeCell | "water";

/**
 * 解いている途中の状態。駒のいるマス `position` と、今の盤面のマス `cells`。
 * `cells` は初期盤面のマスのうち、崩れたもろい岩を氷に、割れた薄い氷を水面に変えたもの。
 * 要素が変わらない滑りの後は、前の状態と同じ配列を共有する。
 */
export type IceFloorMazeState = {
  position: number;
  cells: readonly IceFloorMazeStateCell[];
};

/** 駒が `start` にいて、どの要素もまだ変わっていない状態。 */
export function createIceFloorMazeInitialState(
  board: IceFloorMazeBoard,
  start: number,
): IceFloorMazeState {
  return { position: start, cells: board.cells };
}

export function isSameIceFloorMazeState(
  left: IceFloorMazeState,
  right: IceFloorMazeState,
): boolean {
  return (
    left.position === right.position &&
    (left.cells === right.cells ||
      (left.cells.length === right.cells.length &&
        left.cells.every((cell, cellIndex) => cell === right.cells[cellIndex])))
  );
}
