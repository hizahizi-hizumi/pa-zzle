import {
  assertNanpureBoard,
  getNanpureBlockIndex,
  getNanpureColumnIndex,
  getNanpureRowIndex,
  NANPURE_CELL_COUNT,
  NANPURE_SIZE,
  type NanpureBoard,
  type NanpureDigit,
  type NanpureSolution,
} from "@/games/nanpure/puzzle/board";

const ALL_DIGITS_MASK = 0b11_1111_1110;

export type NanpureSolutionClassification =
  | { status: "unsolvable" }
  | { status: "unique"; solution: NanpureSolution }
  | { status: "multiple" };

export type NanpureSolveOptions = {
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

function createSearchState(board: NanpureBoard): SearchState | null {
  const cells = board.map((cell) => cell ?? 0);
  const rowMasks = new Uint16Array(NANPURE_SIZE);
  const columnMasks = new Uint16Array(NANPURE_SIZE);
  const blockMasks = new Uint16Array(NANPURE_SIZE);

  for (let cellIndex = 0; cellIndex < NANPURE_CELL_COUNT; cellIndex += 1) {
    const digit = cells[cellIndex];
    if (!digit) {
      continue;
    }

    const row = getNanpureRowIndex(cellIndex);
    const column = getNanpureColumnIndex(cellIndex);
    const block = getNanpureBlockIndex(cellIndex);
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
  const row = getNanpureRowIndex(cellIndex);
  const column = getNanpureColumnIndex(cellIndex);
  const block = getNanpureBlockIndex(cellIndex);
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
  let bestCandidateCount = NANPURE_SIZE + 1;

  for (let cellIndex = 0; cellIndex < NANPURE_CELL_COUNT; cellIndex += 1) {
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

function digitsFromMask(mask: number): NanpureDigit[] {
  const digits: NanpureDigit[] = [];

  for (let digit = 1; digit <= NANPURE_SIZE; digit += 1) {
    if ((mask & digitBit(digit)) !== 0) {
      digits.push(digit as NanpureDigit);
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
  digit: NanpureDigit,
): void {
  const row = getNanpureRowIndex(cellIndex);
  const column = getNanpureColumnIndex(cellIndex);
  const block = getNanpureBlockIndex(cellIndex);
  const bit = digitBit(digit);

  state.cells[cellIndex] = digit;
  state.rowMasks[row]! |= bit;
  state.columnMasks[column]! |= bit;
  state.blockMasks[block]! |= bit;
}

function removeDigit(
  state: SearchState,
  cellIndex: number,
  digit: NanpureDigit,
): void {
  const row = getNanpureRowIndex(cellIndex);
  const column = getNanpureColumnIndex(cellIndex);
  const block = getNanpureBlockIndex(cellIndex);
  const bit = digitBit(digit);

  state.cells[cellIndex] = 0;
  state.rowMasks[row]! &= ~bit;
  state.columnMasks[column]! &= ~bit;
  state.blockMasks[block]! &= ~bit;
}

function toSolution(cells: readonly number[]): NanpureSolution {
  return cells.map((cell) => cell as NanpureDigit);
}

function searchSolutions(
  state: SearchState,
  maximumSolutions: number,
  random: (() => number) | undefined,
  solutions: NanpureSolution[],
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
  board: NanpureBoard,
  maximumSolutions: number,
  random?: () => number,
): NanpureSolution[] {
  assertNanpureBoard(board);

  const state = createSearchState(board);
  if (!state) {
    return [];
  }

  const solutions: NanpureSolution[] = [];
  searchSolutions(state, maximumSolutions, random, solutions);
  return solutions;
}

export function findNanpureSolution(
  board: NanpureBoard,
  options: NanpureSolveOptions = {},
): NanpureSolution | null {
  return findSolutions(board, 1, options.random)[0] ?? null;
}

export function classifyNanpureSolutions(
  board: NanpureBoard,
): NanpureSolutionClassification {
  const solutions = findSolutions(board, 2);

  if (solutions.length === 0) {
    return { status: "unsolvable" };
  }

  if (solutions.length === 1) {
    return { status: "unique", solution: solutions[0]! };
  }

  return { status: "multiple" };
}
