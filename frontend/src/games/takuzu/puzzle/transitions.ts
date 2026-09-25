import type { TakuzuBoard, TakuzuCell } from "@/games/takuzu/puzzle/board";

/** `forward` は `空 → A → B → 空`、`backward` は `空 → B → A → 空` の順に巡回する。 */
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

/** 初期配置でタイルが置かれているマスは固定マスで、利用者は変更できない。 */
export function isTakuzuGivenCell(
  givens: TakuzuBoard,
  cellIndex: number,
): boolean {
  return (givens.cells[cellIndex] ?? null) !== null;
}

/** 固定マスや盤面外のマス、すでに同じ中身のマスは変えず、同じ盤面をそのまま返す。 */
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
