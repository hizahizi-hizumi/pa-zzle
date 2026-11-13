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

export type NanpureUnitKind = "row" | "column" | "block";

/** どれか一部だけで調べるのは、ルールを1つずつ示すチュートリアル。 */
export const NANPURE_UNIT_KINDS = [
  "row",
  "column",
  "block",
] as const satisfies readonly NanpureUnitKind[];

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

const unitCellIndicesByKind = {
  row: rowCellIndices,
  column: columnCellIndices,
  block: blockCellIndices,
} as const satisfies Record<NanpureUnitKind, (unit: number) => number[]>;

const unitIndexGetters = {
  row: getNanpureRowIndex,
  column: getNanpureColumnIndex,
  block: getNanpureBlockIndex,
} as const satisfies Record<NanpureUnitKind, (cellIndex: number) => number>;

export function getNanpureCandidates(
  board: NanpureBoard,
  cellIndex: number,
  unitKinds: readonly NanpureUnitKind[] = NANPURE_UNIT_KINDS,
): NanpureDigit[] {
  assertNanpureBoard(board);
  assertNanpureCellIndex(cellIndex);

  if (board[cellIndex] !== null) {
    return [];
  }

  const usedDigits = new Set<NanpureDigit>();

  for (const kind of unitKinds) {
    const unit = unitIndexGetters[kind](cellIndex);
    for (const peerIndex of unitCellIndicesByKind[kind](unit)) {
      const digit = board[peerIndex];
      if (digit !== null && digit !== undefined) {
        usedDigits.add(digit);
      }
    }
  }

  return NANPURE_DIGITS.filter((digit) => !usedDigits.has(digit));
}

export function findNanpureConflictCellIndices(
  board: NanpureBoard,
  unitKinds: readonly NanpureUnitKind[] = NANPURE_UNIT_KINDS,
): number[] {
  assertNanpureBoard(board);

  const conflicts = new Set<number>();

  for (const kind of unitKinds) {
    for (let unit = 0; unit < NANPURE_SIZE; unit += 1) {
      collectUnitConflicts(board, unitCellIndicesByKind[kind](unit), conflicts);
    }
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

/** `index` は0始まりで、ブロックは左上から行優先に数える。 */
export type NanpureUnit = {
  kind: NanpureUnitKind;
  index: number;
};

/** 行は左から、列は上から、ブロックは左上から行優先の順に並べる。 */
export function getNanpureUnitCellIndices({
  kind,
  index,
}: NanpureUnit): number[] {
  return unitCellIndicesByKind[kind](index);
}

/** `cellIndex` を含む行・列・ブロックのうち、9マスすべてが解と同じ数字で埋まったもの。 */
export function findNanpureUnitsCompletedAt(
  board: NanpureBoard,
  solution: NanpureBoard,
  cellIndex: number,
): NanpureUnit[] {
  assertNanpureCellIndex(cellIndex);

  return NANPURE_UNIT_KINDS.flatMap((kind) => {
    const unit = { kind, index: unitIndexGetters[kind](cellIndex) };
    const completed = getNanpureUnitCellIndices(unit).every(
      (peerIndex) =>
        board[peerIndex] !== null && board[peerIndex] === solution[peerIndex],
    );
    return completed ? [unit] : [];
  });
}
