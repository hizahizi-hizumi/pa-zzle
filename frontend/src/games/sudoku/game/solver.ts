import {
  assertSudokuBoard,
  getSudokuBlockIndex,
  getSudokuColumnIndex,
  getSudokuRowIndex,
  SUDOKU_CELL_COUNT,
  SUDOKU_SIZE,
  type SudokuBoard,
  type SudokuDigit,
  type SudokuSolution,
} from "./state";

const ALL_DIGITS_MASK = 0b11_1111_1110;

export type SudokuSolutionClassification =
  | { status: "unsolvable" }
  | { status: "unique"; solution: SudokuSolution }
  | { status: "multiple" };

export type SudokuSolveOptions = {
  random?: () => number;
};

type SearchState = {
  cells: number[];
  rowMasks: Uint16Array;
  columnMasks: Uint16Array;
  blockMasks: Uint16Array;
};

type EmptyCell = {
  cellIndex: number;
  candidateMask: number;
};

function digitBit(digit: number): number {
  return 1 << digit;
}

function createSearchState(board: SudokuBoard): SearchState | null {
  const cells = board.map((cell) => cell ?? 0);
  const rowMasks = new Uint16Array(SUDOKU_SIZE);
  const columnMasks = new Uint16Array(SUDOKU_SIZE);
  const blockMasks = new Uint16Array(SUDOKU_SIZE);

  for (let cellIndex = 0; cellIndex < SUDOKU_CELL_COUNT; cellIndex += 1) {
    const digit = cells[cellIndex];
    if (!digit) {
      continue;
    }

    const row = getSudokuRowIndex(cellIndex);
    const column = getSudokuColumnIndex(cellIndex);
    const block = getSudokuBlockIndex(cellIndex);
    const bit = digitBit(digit);

    if (
      (rowMasks[row]! & bit) !== 0 ||
      (columnMasks[column]! & bit) !== 0 ||
      (blockMasks[block]! & bit) !== 0
    ) {
      return null;
    }

    rowMasks[row]! |= bit;
    columnMasks[column]! |= bit;
    blockMasks[block]! |= bit;
  }

  return { cells, rowMasks, columnMasks, blockMasks };
}

function candidateMask(state: SearchState, cellIndex: number): number {
  const row = getSudokuRowIndex(cellIndex);
  const column = getSudokuColumnIndex(cellIndex);
  const block = getSudokuBlockIndex(cellIndex);
  const usedMask =
    state.rowMasks[row]! |
    state.columnMasks[column]! |
    state.blockMasks[block]!;

  return ALL_DIGITS_MASK & ~usedMask;
}

function countBits(mask: number): number {
  let count = 0;
  let remaining = mask;

  while (remaining !== 0) {
    remaining &= remaining - 1;
    count += 1;
  }

  return count;
}

function findNextEmptyCell(state: SearchState): EmptyCell | null {
  let best: EmptyCell | null = null;
  let bestCandidateCount = SUDOKU_SIZE + 1;

  for (let cellIndex = 0; cellIndex < SUDOKU_CELL_COUNT; cellIndex += 1) {
    if (state.cells[cellIndex] !== 0) {
      continue;
    }

    const mask = candidateMask(state, cellIndex);
    const count = countBits(mask);
    if (count === 0) {
      return { cellIndex, candidateMask: 0 };
    }

    if (count < bestCandidateCount) {
      best = { cellIndex, candidateMask: mask };
      bestCandidateCount = count;
    }
  }

  return best;
}

function digitsFromMask(mask: number): SudokuDigit[] {
  const digits: SudokuDigit[] = [];

  for (let digit = 1; digit <= SUDOKU_SIZE; digit += 1) {
    if ((mask & digitBit(digit)) !== 0) {
      digits.push(digit as SudokuDigit);
    }
  }

  return digits;
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }

  return result;
}

function placeDigit(
  state: SearchState,
  cellIndex: number,
  digit: SudokuDigit,
): void {
  const row = getSudokuRowIndex(cellIndex);
  const column = getSudokuColumnIndex(cellIndex);
  const block = getSudokuBlockIndex(cellIndex);
  const bit = digitBit(digit);

  state.cells[cellIndex] = digit;
  state.rowMasks[row]! |= bit;
  state.columnMasks[column]! |= bit;
  state.blockMasks[block]! |= bit;
}

function removeDigit(
  state: SearchState,
  cellIndex: number,
  digit: SudokuDigit,
): void {
  const row = getSudokuRowIndex(cellIndex);
  const column = getSudokuColumnIndex(cellIndex);
  const block = getSudokuBlockIndex(cellIndex);
  const bit = digitBit(digit);

  state.cells[cellIndex] = 0;
  state.rowMasks[row]! &= ~bit;
  state.columnMasks[column]! &= ~bit;
  state.blockMasks[block]! &= ~bit;
}

function toSolution(cells: readonly number[]): SudokuSolution {
  return cells.map((cell) => cell as SudokuDigit);
}

function searchSolutions(
  state: SearchState,
  maximumSolutions: number,
  random: (() => number) | undefined,
  solutions: SudokuSolution[],
): void {
  if (solutions.length >= maximumSolutions) {
    return;
  }

  const emptyCell = findNextEmptyCell(state);
  if (emptyCell === null) {
    solutions.push(toSolution(state.cells));
    return;
  }

  if (emptyCell.candidateMask === 0) {
    return;
  }

  const candidates = digitsFromMask(emptyCell.candidateMask);
  const orderedCandidates = random ? shuffled(candidates, random) : candidates;

  for (const digit of orderedCandidates) {
    placeDigit(state, emptyCell.cellIndex, digit);
    searchSolutions(state, maximumSolutions, random, solutions);
    removeDigit(state, emptyCell.cellIndex, digit);

    if (solutions.length >= maximumSolutions) {
      return;
    }
  }
}

function findSolutions(
  board: SudokuBoard,
  maximumSolutions: number,
  random?: () => number,
): SudokuSolution[] {
  assertSudokuBoard(board);

  const state = createSearchState(board);
  if (!state) {
    return [];
  }

  const solutions: SudokuSolution[] = [];
  searchSolutions(state, maximumSolutions, random, solutions);
  return solutions;
}

export function findSudokuSolution(
  board: SudokuBoard,
  options: SudokuSolveOptions = {},
): SudokuSolution | null {
  return findSolutions(board, 1, options.random)[0] ?? null;
}

export function classifySudokuSolutions(
  board: SudokuBoard,
): SudokuSolutionClassification {
  const solutions = findSolutions(board, 2);

  if (solutions.length === 0) {
    return { status: "unsolvable" };
  }

  if (solutions.length === 1) {
    return { status: "unique", solution: solutions[0]! };
  }

  return { status: "multiple" };
}
