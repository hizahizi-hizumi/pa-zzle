import {
  findSlidePuzzleBlankIndex,
  getSlidePuzzleColumn,
  getSlidePuzzleRow,
  isStandardSlidePuzzleBoard,
  SLIDE_PUZZLE_BLANK,
  SLIDE_PUZZLE_CELL_COUNT,
  SLIDE_PUZZLE_SIZE,
  type SlidePuzzleBoard,
} from "@/games/slide-puzzle/puzzle/state";

/** タイルが動く向き。 */
export type SlidePuzzleDirection = "up" | "down" | "left" | "right";

export type SlidePuzzleSlide = {
  direction: SlidePuzzleDirection;
  /** 動く前のマス index。空白に近い順に並ぶ。 */
  movedTileIndices: readonly number[];
};

const cellOffsetByDirection: Record<SlidePuzzleDirection, number> = {
  up: -SLIDE_PUZZLE_SIZE,
  down: SLIDE_PUZZLE_SIZE,
  left: -1,
  right: 1,
};

function isSlidePuzzleCellIndex(cellIndex: number): boolean {
  return (
    Number.isInteger(cellIndex) &&
    cellIndex >= 0 &&
    cellIndex < SLIDE_PUZZLE_CELL_COUNT
  );
}

function getSlideDirection(
  tileIndex: number,
  blankIndex: number,
): SlidePuzzleDirection | null {
  if (getSlidePuzzleRow(tileIndex) === getSlidePuzzleRow(blankIndex)) {
    return tileIndex < blankIndex ? "right" : "left";
  }

  if (getSlidePuzzleColumn(tileIndex) === getSlidePuzzleColumn(blankIndex)) {
    return tileIndex < blankIndex ? "down" : "up";
  }

  return null;
}

/**
 * 空白と同じ行・列にあるタイルから空白までのタイルを、まとめて空白側へ 1 マスずつ滑らせる。
 * 空白と同じ行・列にないマスや空白自体では成立しない。
 */
export function getSlidePuzzleSlide(
  board: SlidePuzzleBoard,
  tileIndex: number,
): SlidePuzzleSlide | null {
  if (!isSlidePuzzleCellIndex(tileIndex)) {
    return null;
  }

  const blankIndex = findSlidePuzzleBlankIndex(board);
  if (tileIndex === blankIndex) {
    return null;
  }

  const direction = getSlideDirection(tileIndex, blankIndex);
  if (!direction) {
    return null;
  }

  const step = -cellOffsetByDirection[direction];
  const movedTileIndices: number[] = [];
  for (
    let cellIndex = blankIndex + step;
    cellIndex !== tileIndex + step;
    cellIndex += step
  ) {
    movedTileIndices.push(cellIndex);
  }

  return { direction, movedTileIndices };
}

export function applySlidePuzzleSlide(
  board: SlidePuzzleBoard,
  slide: SlidePuzzleSlide,
): SlidePuzzleBoard {
  const nextBoard = [...board];
  let blankIndex = findSlidePuzzleBlankIndex(board);
  for (const tileIndex of slide.movedTileIndices) {
    nextBoard[blankIndex] = board[tileIndex] ?? SLIDE_PUZZLE_BLANK;
    blankIndex = tileIndex;
  }
  nextBoard[blankIndex] = SLIDE_PUZZLE_BLANK;

  return nextBoard;
}

/** 空白に隣接し、1 枚だけで滑らせられるタイルのマス index。 */
export function listSlidePuzzleSingleMoves(board: SlidePuzzleBoard): number[] {
  const blankIndex = findSlidePuzzleBlankIndex(board);

  return Object.values(cellOffsetByDirection)
    .map((offset) => blankIndex + offset)
    .filter(
      (cellIndex) =>
        isSlidePuzzleCellIndex(cellIndex) &&
        getSlideDirection(cellIndex, blankIndex) !== null,
    );
}

/** 押した方向へ、空白の隣のタイルを 1 枚滑らせる。 */
export function getSlidePuzzleKeyboardSlide(
  board: SlidePuzzleBoard,
  direction: SlidePuzzleDirection,
): SlidePuzzleSlide | null {
  const tileIndex =
    findSlidePuzzleBlankIndex(board) - cellOffsetByDirection[direction];
  const slide = getSlidePuzzleSlide(board, tileIndex);

  return slide?.direction === direction ? slide : null;
}

/**
 * 幅が偶数の盤面では、空白を除いたタイル列の転倒数と、空白が下から何行目にあるかの和が
 * 奇数のときに限って完成盤面へ到達できる。
 */
export function isSolvableSlidePuzzleBoard(board: SlidePuzzleBoard): boolean {
  if (!isStandardSlidePuzzleBoard(board)) {
    return false;
  }

  const tiles = board.filter((tile) => tile !== SLIDE_PUZZLE_BLANK);
  let inversionCount = 0;
  for (const [index, tile] of tiles.entries()) {
    for (const laterTile of tiles.slice(index + 1)) {
      if (tile > laterTile) {
        inversionCount += 1;
      }
    }
  }

  const blankRowFromBottom =
    SLIDE_PUZZLE_SIZE - getSlidePuzzleRow(findSlidePuzzleBlankIndex(board));

  return (inversionCount + blankRowFromBottom) % 2 === 1;
}
