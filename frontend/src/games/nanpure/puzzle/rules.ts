import {
  assertNanpureBoard,
  assertNanpureCellIndex,
  getNanpureBlockIndex,
  getNanpureColumnIndex,
  getNanpureRowIndex,
  NANPURE_BLOCK_SIZE,
  NANPURE_DIGITS,
  NANPURE_SIZE,
  type NanpureBoard,
  type NanpureDigit,
} from "@/games/nanpure/puzzle/board";

function collectUnitConflicts(
  board: NanpureBoard,
  cellIndices: readonly number[],
  conflicts: Set<number>,
): void {
  const cellsByDigit = new Map<NanpureDigit, number[]>();

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
    { length: NANPURE_SIZE },
    (_, column) => row * NANPURE_SIZE + column,
  );
}

function columnCellIndices(column: number): number[] {
  return Array.from(
    { length: NANPURE_SIZE },
    (_, row) => row * NANPURE_SIZE + column,
  );
}

function blockCellIndices(block: number): number[] {
  const firstRow = Math.floor(block / NANPURE_BLOCK_SIZE) * NANPURE_BLOCK_SIZE;
  const firstColumn = (block % NANPURE_BLOCK_SIZE) * NANPURE_BLOCK_SIZE;
  const indices: number[] = [];

  for (let rowOffset = 0; rowOffset < NANPURE_BLOCK_SIZE; rowOffset += 1) {
    for (
      let columnOffset = 0;
      columnOffset < NANPURE_BLOCK_SIZE;
      columnOffset += 1
    ) {
      indices.push(
        (firstRow + rowOffset) * NANPURE_SIZE + firstColumn + columnOffset,
      );
    }
  }

  return indices;
}

export function getNanpureCandidates(
  board: NanpureBoard,
  cellIndex: number,
): NanpureDigit[] {
  assertNanpureBoard(board);
  assertNanpureCellIndex(cellIndex);

  if (board[cellIndex] !== null) {
    return [];
  }

  const row = getNanpureRowIndex(cellIndex);
  const column = getNanpureColumnIndex(cellIndex);
  const block = getNanpureBlockIndex(cellIndex);
  const usedDigits = new Set<NanpureDigit>();

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

  return NANPURE_DIGITS.filter((digit) => !usedDigits.has(digit));
}

export function findNanpureConflictCellIndices(board: NanpureBoard): number[] {
  assertNanpureBoard(board);

  const conflicts = new Set<number>();

  for (let unit = 0; unit < NANPURE_SIZE; unit += 1) {
    collectUnitConflicts(board, rowCellIndices(unit), conflicts);
    collectUnitConflicts(board, columnCellIndices(unit), conflicts);
    collectUnitConflicts(board, blockCellIndices(unit), conflicts);
  }

  return [...conflicts].sort((left, right) => left - right);
}

export function isNanpureBoardConsistent(board: NanpureBoard): boolean {
  return findNanpureConflictCellIndices(board).length === 0;
}

export function isNanpureSolved(board: NanpureBoard): boolean {
  assertNanpureBoard(board);

  return (
    board.every((cell) => cell !== null) && isNanpureBoardConsistent(board)
  );
}
