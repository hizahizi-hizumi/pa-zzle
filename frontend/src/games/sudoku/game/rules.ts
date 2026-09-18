import {
  assertSudokuBoard,
  assertSudokuCellIndex,
  getSudokuBlockIndex,
  getSudokuColumnIndex,
  getSudokuRowIndex,
  SUDOKU_BLOCK_SIZE,
  SUDOKU_DIGITS,
  SUDOKU_SIZE,
  type SudokuBoard,
  type SudokuDigit,
} from "./state";

function collectUnitConflicts(
  board: SudokuBoard,
  cellIndices: readonly number[],
  conflicts: Set<number>,
): void {
  const cellsByDigit = new Map<SudokuDigit, number[]>();

  for (const cellIndex of cellIndices) {
    const digit = board[cellIndex];
    if (digit === null || digit === undefined) {
      continue;
    }

    const matchingCells = cellsByDigit.get(digit) ?? [];
    matchingCells.push(cellIndex);
    cellsByDigit.set(digit, matchingCells);
  }

  for (const matchingCells of cellsByDigit.values()) {
    if (matchingCells.length < 2) {
      continue;
    }

    for (const cellIndex of matchingCells) {
      conflicts.add(cellIndex);
    }
  }
}

function rowCellIndices(row: number): number[] {
  return Array.from(
    { length: SUDOKU_SIZE },
    (_, column) => row * SUDOKU_SIZE + column,
  );
}

function columnCellIndices(column: number): number[] {
  return Array.from(
    { length: SUDOKU_SIZE },
    (_, row) => row * SUDOKU_SIZE + column,
  );
}

function blockCellIndices(block: number): number[] {
  const firstRow = Math.floor(block / SUDOKU_BLOCK_SIZE) * SUDOKU_BLOCK_SIZE;
  const firstColumn = (block % SUDOKU_BLOCK_SIZE) * SUDOKU_BLOCK_SIZE;
  const indices: number[] = [];

  for (let rowOffset = 0; rowOffset < SUDOKU_BLOCK_SIZE; rowOffset += 1) {
    for (
      let columnOffset = 0;
      columnOffset < SUDOKU_BLOCK_SIZE;
      columnOffset += 1
    ) {
      indices.push(
        (firstRow + rowOffset) * SUDOKU_SIZE + firstColumn + columnOffset,
      );
    }
  }

  return indices;
}

export function getSudokuCandidates(
  board: SudokuBoard,
  cellIndex: number,
): SudokuDigit[] {
  assertSudokuBoard(board);
  assertSudokuCellIndex(cellIndex);

  if (board[cellIndex] !== null) {
    return [];
  }

  const row = getSudokuRowIndex(cellIndex);
  const column = getSudokuColumnIndex(cellIndex);
  const block = getSudokuBlockIndex(cellIndex);
  const usedDigits = new Set<SudokuDigit>();

  for (const peerIndex of rowCellIndices(row)) {
    const digit = board[peerIndex];
    if (digit !== null && digit !== undefined) {
      usedDigits.add(digit);
    }
  }

  for (const peerIndex of columnCellIndices(column)) {
    const digit = board[peerIndex];
    if (digit !== null && digit !== undefined) {
      usedDigits.add(digit);
    }
  }

  for (const peerIndex of blockCellIndices(block)) {
    const digit = board[peerIndex];
    if (digit !== null && digit !== undefined) {
      usedDigits.add(digit);
    }
  }

  return SUDOKU_DIGITS.filter((digit) => !usedDigits.has(digit));
}

export function findSudokuConflictCellIndices(board: SudokuBoard): number[] {
  assertSudokuBoard(board);

  const conflicts = new Set<number>();

  for (let unit = 0; unit < SUDOKU_SIZE; unit += 1) {
    collectUnitConflicts(board, rowCellIndices(unit), conflicts);
    collectUnitConflicts(board, columnCellIndices(unit), conflicts);
    collectUnitConflicts(board, blockCellIndices(unit), conflicts);
  }

  return [...conflicts].sort((left, right) => left - right);
}

export function isSudokuBoardConsistent(board: SudokuBoard): boolean {
  return findSudokuConflictCellIndices(board).length === 0;
}

export function isSudokuSolved(board: SudokuBoard): boolean {
  assertSudokuBoard(board);

  return board.every((cell) => cell !== null) && isSudokuBoardConsistent(board);
}
