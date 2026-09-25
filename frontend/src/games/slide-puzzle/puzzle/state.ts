export const SLIDE_PUZZLE_SIZE = 4;
export const SLIDE_PUZZLE_CELL_COUNT = SLIDE_PUZZLE_SIZE * SLIDE_PUZZLE_SIZE;
export const SLIDE_PUZZLE_BLANK = 0;

/** 1〜15 がタイル番号、`SLIDE_PUZZLE_BLANK` が空白。 */
export type SlidePuzzleTile = number;
/** 行優先で並べた 16 マス。 */
export type SlidePuzzleBoard = readonly SlidePuzzleTile[];

export function getSlidePuzzleRow(cellIndex: number): number {
  return Math.floor(cellIndex / SLIDE_PUZZLE_SIZE);
}

export function getSlidePuzzleColumn(cellIndex: number): number {
  return cellIndex % SLIDE_PUZZLE_SIZE;
}

export function createSolvedSlidePuzzleBoard(): SlidePuzzleBoard {
  return Array.from({ length: SLIDE_PUZZLE_CELL_COUNT }, (_, cellIndex) =>
    cellIndex === SLIDE_PUZZLE_CELL_COUNT - 1
      ? SLIDE_PUZZLE_BLANK
      : cellIndex + 1,
  );
}

export function isSlidePuzzleSolved(board: SlidePuzzleBoard): boolean {
  return board.every((tile, cellIndex) =>
    cellIndex === SLIDE_PUZZLE_CELL_COUNT - 1
      ? tile === SLIDE_PUZZLE_BLANK
      : tile === cellIndex + 1,
  );
}

export function findSlidePuzzleBlankIndex(board: SlidePuzzleBoard): number {
  const blankIndex = board.indexOf(SLIDE_PUZZLE_BLANK);
  if (blankIndex < 0) {
    throw new Error("Slide puzzle board must contain a blank");
  }

  return blankIndex;
}

export function calculateSlidePuzzleManhattanDistance(
  board: SlidePuzzleBoard,
): number {
  let distance = 0;
  for (const [cellIndex, tile] of board.entries()) {
    if (tile === SLIDE_PUZZLE_BLANK) {
      continue;
    }

    const goalIndex = tile - 1;
    distance +=
      Math.abs(getSlidePuzzleRow(cellIndex) - getSlidePuzzleRow(goalIndex)) +
      Math.abs(
        getSlidePuzzleColumn(cellIndex) - getSlidePuzzleColumn(goalIndex),
      );
  }

  return distance;
}

export function isStandardSlidePuzzleBoard(
  board: unknown,
): board is SlidePuzzleBoard {
  if (!Array.isArray(board) || board.length !== SLIDE_PUZZLE_CELL_COUNT) {
    return false;
  }

  const tiles = new Set<number>();
  for (const tile of board) {
    if (
      !Number.isInteger(tile) ||
      tile < 0 ||
      tile >= SLIDE_PUZZLE_CELL_COUNT
    ) {
      return false;
    }
    tiles.add(tile);
  }

  return tiles.size === SLIDE_PUZZLE_CELL_COUNT;
}
