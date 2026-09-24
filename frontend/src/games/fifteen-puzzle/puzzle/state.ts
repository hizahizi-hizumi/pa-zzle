export const FIFTEEN_PUZZLE_SIZE = 4;
export const FIFTEEN_PUZZLE_CELL_COUNT =
  FIFTEEN_PUZZLE_SIZE * FIFTEEN_PUZZLE_SIZE;
export const FIFTEEN_PUZZLE_BLANK = 0;

/** 1〜15 がタイル番号、`FIFTEEN_PUZZLE_BLANK` が空白。 */
export type FifteenPuzzleTile = number;
/** 行優先で並べた 16 マス。 */
export type FifteenPuzzleBoard = readonly FifteenPuzzleTile[];

export function getFifteenPuzzleRow(cellIndex: number): number {
  return Math.floor(cellIndex / FIFTEEN_PUZZLE_SIZE);
}

export function getFifteenPuzzleColumn(cellIndex: number): number {
  return cellIndex % FIFTEEN_PUZZLE_SIZE;
}

export function createSolvedFifteenPuzzleBoard(): FifteenPuzzleBoard {
  return Array.from({ length: FIFTEEN_PUZZLE_CELL_COUNT }, (_, cellIndex) =>
    cellIndex === FIFTEEN_PUZZLE_CELL_COUNT - 1
      ? FIFTEEN_PUZZLE_BLANK
      : cellIndex + 1,
  );
}

export function isFifteenPuzzleSolved(board: FifteenPuzzleBoard): boolean {
  return board.every((tile, cellIndex) =>
    cellIndex === FIFTEEN_PUZZLE_CELL_COUNT - 1
      ? tile === FIFTEEN_PUZZLE_BLANK
      : tile === cellIndex + 1,
  );
}

export function findFifteenPuzzleBlankIndex(board: FifteenPuzzleBoard): number {
  const blankIndex = board.indexOf(FIFTEEN_PUZZLE_BLANK);
  if (blankIndex < 0) {
    throw new Error("Fifteen puzzle board must contain a blank");
  }

  return blankIndex;
}

export function calculateFifteenPuzzleManhattanDistance(
  board: FifteenPuzzleBoard,
): number {
  let distance = 0;
  for (const [cellIndex, tile] of board.entries()) {
    if (tile === FIFTEEN_PUZZLE_BLANK) {
      continue;
    }

    const goalIndex = tile - 1;
    distance +=
      Math.abs(
        getFifteenPuzzleRow(cellIndex) - getFifteenPuzzleRow(goalIndex),
      ) +
      Math.abs(
        getFifteenPuzzleColumn(cellIndex) - getFifteenPuzzleColumn(goalIndex),
      );
  }

  return distance;
}

export function isStandardFifteenPuzzleBoard(
  board: unknown,
): board is FifteenPuzzleBoard {
  if (!Array.isArray(board) || board.length !== FIFTEEN_PUZZLE_CELL_COUNT) {
    return false;
  }

  const tiles = new Set<number>();
  for (const tile of board) {
    if (
      !Number.isInteger(tile) ||
      tile < 0 ||
      tile >= FIFTEEN_PUZZLE_CELL_COUNT
    ) {
      return false;
    }
    tiles.add(tile);
  }

  return tiles.size === FIFTEEN_PUZZLE_CELL_COUNT;
}
