/** 遊べる盤面の一辺のマス数。 */
export const SLIDE_PUZZLE_BOARD_SIZES = [3, 4, 5] as const;
export type SlidePuzzleBoardSize = (typeof SLIDE_PUZZLE_BOARD_SIZES)[number];

export const SLIDE_PUZZLE_BLANK = 0;

/** 1〜（マス数 − 1）がタイル番号、`SLIDE_PUZZLE_BLANK` が空白。 */
export type SlidePuzzleTile = number;
/** 行優先で並べた、一辺 × 一辺のマス。盤面サイズはマス数から決まる。 */
export type SlidePuzzleBoard = readonly SlidePuzzleTile[];

export function isSlidePuzzleBoardSize(
  value: unknown,
): value is SlidePuzzleBoardSize {
  return SLIDE_PUZZLE_BOARD_SIZES.some((size) => size === value);
}

function findBoardSizeOfCellCount(
  cellCount: number,
): SlidePuzzleBoardSize | undefined {
  return SLIDE_PUZZLE_BOARD_SIZES.find((size) => size * size === cellCount);
}

export function getSlidePuzzleBoardSize(
  board: SlidePuzzleBoard,
): SlidePuzzleBoardSize {
  const boardSize = findBoardSizeOfCellCount(board.length);
  if (boardSize === undefined) {
    throw new RangeError(
      `Slide puzzle board must have ${SLIDE_PUZZLE_BOARD_SIZES.map((size) => size * size).join(", ")} cells`,
    );
  }

  return boardSize;
}

export function getSlidePuzzleRow(
  cellIndex: number,
  boardSize: SlidePuzzleBoardSize,
): number {
  return Math.floor(cellIndex / boardSize);
}

export function getSlidePuzzleColumn(
  cellIndex: number,
  boardSize: SlidePuzzleBoardSize,
): number {
  return cellIndex % boardSize;
}

export function createSolvedSlidePuzzleBoard(
  boardSize: SlidePuzzleBoardSize,
): SlidePuzzleBoard {
  const cellCount = boardSize * boardSize;
  return Array.from({ length: cellCount }, (_, cellIndex) =>
    cellIndex === cellCount - 1 ? SLIDE_PUZZLE_BLANK : cellIndex + 1,
  );
}

export function isSlidePuzzleSolved(board: SlidePuzzleBoard): boolean {
  return board.every((tile, cellIndex) =>
    cellIndex === board.length - 1
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
  const boardSize = getSlidePuzzleBoardSize(board);
  let distance = 0;
  for (const [cellIndex, tile] of board.entries()) {
    if (tile === SLIDE_PUZZLE_BLANK) {
      continue;
    }

    const goalIndex = tile - 1;
    distance +=
      Math.abs(
        getSlidePuzzleRow(cellIndex, boardSize) -
          getSlidePuzzleRow(goalIndex, boardSize),
      ) +
      Math.abs(
        getSlidePuzzleColumn(cellIndex, boardSize) -
          getSlidePuzzleColumn(goalIndex, boardSize),
      );
  }

  return distance;
}

/** 遊べるサイズのマス数で、空白とタイル番号を 1 つずつ並べた盤面かを確かめる。 */
export function isStandardSlidePuzzleBoard(
  board: unknown,
): board is SlidePuzzleBoard {
  if (
    !Array.isArray(board) ||
    findBoardSizeOfCellCount(board.length) === undefined
  ) {
    return false;
  }

  const tiles = new Set<number>();
  for (const tile of board) {
    if (!Number.isInteger(tile) || tile < 0 || tile >= board.length) {
      return false;
    }
    tiles.add(tile);
  }

  return tiles.size === board.length;
}
