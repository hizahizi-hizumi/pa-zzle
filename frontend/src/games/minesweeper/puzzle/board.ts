export type MinesweeperBoard = {
  rows: number;
  columns: number;
  mineCellIndices: readonly number[];
};

export function getMinesweeperCellCount(board: MinesweeperBoard): number {
  return board.rows * board.columns;
}

export function assertMinesweeperBoard(board: MinesweeperBoard): void {
  if (!Number.isInteger(board.rows) || board.rows <= 0) {
    throw new RangeError("Minesweeper board rows must be a positive integer");
  }

  if (!Number.isInteger(board.columns) || board.columns <= 0) {
    throw new RangeError(
      "Minesweeper board columns must be a positive integer",
    );
  }

  const cellCount = getMinesweeperCellCount(board);
  const mines = new Set<number>();

  for (const cellIndex of board.mineCellIndices) {
    assertMinesweeperCellIndex(board, cellIndex);
    if (mines.has(cellIndex)) {
      throw new Error("Minesweeper board mine cells must be unique");
    }
    mines.add(cellIndex);
  }

  if (mines.size >= cellCount) {
    throw new Error("Minesweeper board must contain at least one safe cell");
  }
}

export function assertMinesweeperCellIndex(
  board: MinesweeperBoard,
  cellIndex: number,
): void {
  const cellCount = getMinesweeperCellCount(board);
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= cellCount) {
    throw new RangeError(
      `Minesweeper cell index must be between 0 and ${cellCount - 1}`,
    );
  }
}

export function getMinesweeperNeighborCellIndices(
  board: MinesweeperBoard,
  cellIndex: number,
): number[] {
  assertMinesweeperCellIndex(board, cellIndex);

  const row = Math.floor(cellIndex / board.columns);
  const column = cellIndex % board.columns;
  const neighbors: number[] = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) {
        continue;
      }

      const neighborRow = row + rowOffset;
      const neighborColumn = column + columnOffset;
      if (
        neighborRow < 0 ||
        neighborRow >= board.rows ||
        neighborColumn < 0 ||
        neighborColumn >= board.columns
      ) {
        continue;
      }

      neighbors.push(neighborRow * board.columns + neighborColumn);
    }
  }

  return neighbors;
}
