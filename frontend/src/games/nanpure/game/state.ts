export const NANPURE_SIZE = 9;
export const NANPURE_BLOCK_SIZE = 3;
export const NANPURE_CELL_COUNT = NANPURE_SIZE * NANPURE_SIZE;
export const NANPURE_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export type NanpureDigit = (typeof NANPURE_DIGITS)[number];
export type NanpureCell = NanpureDigit | null;
export type NanpureBoard = readonly NanpureCell[];
export type NanpureSolution = readonly NanpureDigit[];

export type NanpureProblem = {
  clues: NanpureBoard;
  solution: NanpureSolution;
};

export function isNanpureDigit(value: unknown): value is NanpureDigit {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= NANPURE_SIZE
  );
}

export function assertNanpureBoard(board: NanpureBoard): void {
  if (board.length !== NANPURE_CELL_COUNT) {
    throw new RangeError(
      `Nanpure board must contain ${NANPURE_CELL_COUNT} cells`,
    );
  }

  if (board.some((cell) => cell !== null && !isNanpureDigit(cell))) {
    throw new TypeError(
      "Nanpure board cells must be null or digits from 1 to 9",
    );
  }
}

export function assertNanpureCellIndex(cellIndex: number): void {
  if (
    !Number.isInteger(cellIndex) ||
    cellIndex < 0 ||
    cellIndex >= NANPURE_CELL_COUNT
  ) {
    throw new RangeError(
      `Nanpure cell index must be between 0 and ${NANPURE_CELL_COUNT - 1}`,
    );
  }
}

export function getNanpureRowIndex(cellIndex: number): number {
  assertNanpureCellIndex(cellIndex);
  return Math.floor(cellIndex / NANPURE_SIZE);
}

export function getNanpureColumnIndex(cellIndex: number): number {
  assertNanpureCellIndex(cellIndex);
  return cellIndex % NANPURE_SIZE;
}

export function getNanpureBlockIndex(cellIndex: number): number {
  const row = getNanpureRowIndex(cellIndex);
  const column = getNanpureColumnIndex(cellIndex);

  return (
    Math.floor(row / NANPURE_BLOCK_SIZE) * NANPURE_BLOCK_SIZE +
    Math.floor(column / NANPURE_BLOCK_SIZE)
  );
}

export function areNanpureCellsRelated(left: number, right: number): boolean {
  return (
    getNanpureRowIndex(left) === getNanpureRowIndex(right) ||
    getNanpureColumnIndex(left) === getNanpureColumnIndex(right) ||
    getNanpureBlockIndex(left) === getNanpureBlockIndex(right)
  );
}
