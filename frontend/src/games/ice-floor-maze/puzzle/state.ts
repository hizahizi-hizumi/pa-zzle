import type {
  IceFloorMazeBoard,
  IceFloorMazeCell,
} from "@/games/ice-floor-maze/puzzle/board";

/**
 * 解いている途中の盤面のマス。初期盤面のマスのうち滑る氷の塊を除いたものに、薄い氷が割れた後の水面（`water`）と、
 * 雪を押し出してできた雪山（`snow-mound`）を足したもの。滑る氷の塊はマスではなく、状態の `blocks` で持つ。
 */
export type IceFloorMazeStateCell =
  | Exclude<IceFloorMazeCell, "sliding-block">
  | "water"
  | "snow-mound";

/**
 * 解いている途中の状態。駒のいるマス `position`、今の盤面のマス `cells`、滑る氷の塊のあるマス `blocks`（昇順）。
 * `cells` は初期盤面のマスのうち、崩れたもろい岩を氷に、割れた薄い氷を水面に、押し出した雪を氷に、雪を押し出した先を雪山に、
 * 滑る氷の塊の元のマスを氷に変えたもの。塊は区別せず、どのマスにあるかだけを持つ。
 * 盤面のマスが変わらない滑りの後は、前の状態と同じ配列を共有する。
 */
export type IceFloorMazeState = {
  position: number;
  cells: readonly IceFloorMazeStateCell[];
  blocks: readonly number[];
};

const noBlocks: readonly number[] = [];

export function createIceFloorMazeInitialState(
  board: IceFloorMazeBoard,
  start: number,
): IceFloorMazeState {
  if (!board.cells.includes("sliding-block")) {
    return {
      position: start,
      cells: board.cells as readonly IceFloorMazeStateCell[],
      blocks: noBlocks,
    };
  }
  return {
    position: start,
    cells: board.cells.map(
      (cell): IceFloorMazeStateCell =>
        cell === "sliding-block" ? "ice" : cell,
    ),
    blocks: board.cells.flatMap((cell, cellIndex) =>
      cell === "sliding-block" ? [cellIndex] : [],
    ),
  };
}

function isSameCellList<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left === right ||
    (left.length === right.length &&
      left.every((value, index) => value === right[index]))
  );
}

export function isSameIceFloorMazeState(
  left: IceFloorMazeState,
  right: IceFloorMazeState,
): boolean {
  return (
    left.position === right.position &&
    isSameCellList(left.cells, right.cells) &&
    isSameCellList(left.blocks, right.blocks)
  );
}
