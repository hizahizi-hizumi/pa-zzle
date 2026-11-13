import type { TakuzuBoard, TakuzuCell } from "@/games/takuzu/puzzle/board";

export type TakuzuCycleDirection = "forward" | "backward";

const cycleOrder = [null, "a", "b"] as const satisfies readonly TakuzuCell[];

export function getNextTakuzuCell(
  cell: TakuzuCell,
  direction: TakuzuCycleDirection,
): TakuzuCell {
  const step = direction === "forward" ? 1 : cycleOrder.length - 1;
  const nextPosition = (cycleOrder.indexOf(cell) + step) % cycleOrder.length;
  return cycleOrder[nextPosition] ?? null;
}

export function isTakuzuGivenCell(
  givens: TakuzuBoard,
  cellIndex: number,
): boolean {
  return (givens.cells[cellIndex] ?? null) !== null;
}

export function placeTakuzuCell(
  givens: TakuzuBoard,
  board: TakuzuBoard,
  cellIndex: number,
  cell: TakuzuCell,
): TakuzuBoard {
  const currentCell = board.cells[cellIndex];
  if (
    currentCell === undefined ||
    currentCell === cell ||
    isTakuzuGivenCell(givens, cellIndex)
  ) {
    return board;
  }

  const cells = [...board.cells];
  cells[cellIndex] = cell;
  return { ...board, cells };
}
