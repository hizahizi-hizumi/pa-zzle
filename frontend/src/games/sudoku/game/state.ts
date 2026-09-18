export const SUDOKU_SIZE = 9;
export const SUDOKU_BLOCK_SIZE = 3;
export const SUDOKU_CELL_COUNT = SUDOKU_SIZE * SUDOKU_SIZE;
export const SUDOKU_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export type SudokuDigit = (typeof SUDOKU_DIGITS)[number];
export type SudokuCell = SudokuDigit | null;
export type SudokuBoard = readonly SudokuCell[];
export type SudokuSolution = readonly SudokuDigit[];

export type SudokuProblem = {
  clues: SudokuBoard;
  solution: SudokuSolution;
};

export function isSudokuDigit(value: unknown): value is SudokuDigit {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= SUDOKU_SIZE
  );
}

export function assertSudokuBoard(board: SudokuBoard): void {
  if (board.length !== SUDOKU_CELL_COUNT) {
    throw new RangeError(
      `Sudoku board must contain ${SUDOKU_CELL_COUNT} cells`,
    );
  }

  if (board.some((cell) => cell !== null && !isSudokuDigit(cell))) {
    throw new TypeError(
      "Sudoku board cells must be null or digits from 1 to 9",
    );
  }
}

export function assertSudokuCellIndex(cellIndex: number): void {
  if (
    !Number.isInteger(cellIndex) ||
    cellIndex < 0 ||
    cellIndex >= SUDOKU_CELL_COUNT
  ) {
    throw new RangeError(
      `Sudoku cell index must be between 0 and ${SUDOKU_CELL_COUNT - 1}`,
    );
  }
}

export function getSudokuRowIndex(cellIndex: number): number {
  assertSudokuCellIndex(cellIndex);
  return Math.floor(cellIndex / SUDOKU_SIZE);
}

export function getSudokuColumnIndex(cellIndex: number): number {
  assertSudokuCellIndex(cellIndex);
  return cellIndex % SUDOKU_SIZE;
}

export function getSudokuBlockIndex(cellIndex: number): number {
  const row = getSudokuRowIndex(cellIndex);
  const column = getSudokuColumnIndex(cellIndex);

  return (
    Math.floor(row / SUDOKU_BLOCK_SIZE) * SUDOKU_BLOCK_SIZE +
    Math.floor(column / SUDOKU_BLOCK_SIZE)
  );
}
