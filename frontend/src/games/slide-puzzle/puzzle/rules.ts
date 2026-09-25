import {
  findSlidePuzzleBlankIndex,
  getSlidePuzzleBoardSize,
  getSlidePuzzleColumn,
  getSlidePuzzleRow,
  isStandardSlidePuzzleBoard,
  SLIDE_PUZZLE_BLANK,
  type SlidePuzzleBoard,
  type SlidePuzzleBoardSize,
} from "@/games/slide-puzzle/puzzle/state";

/** タイルが動く向き。 */
export type SlidePuzzleDirection = "up" | "down" | "left" | "right";

export type SlidePuzzleSlide = {
  direction: SlidePuzzleDirection;
  /** 動く前のマス index。空白に近い順に並ぶ。 */
  movedTileIndices: readonly number[];
};

const slideDirections: readonly SlidePuzzleDirection[] = [
  "up",
  "down",
  "left",
  "right",
];

/** タイルが動く向きへ 1 マス進んだときのマス index の差。 */
function getCellOffset(
  direction: SlidePuzzleDirection,
  boardSize: SlidePuzzleBoardSize,
): number {
  switch (direction) {
    case "up":
      return -boardSize;
    case "down":
      return boardSize;
    case "left":
      return -1;
    case "right":
      return 1;
  }
}

function isSlidePuzzleCellIndex(
  cellIndex: number,
  board: SlidePuzzleBoard,
): boolean {
  return (
    Number.isInteger(cellIndex) && cellIndex >= 0 && cellIndex < board.length
  );
}

function getSlideDirection(
  tileIndex: number,
  blankIndex: number,
  boardSize: SlidePuzzleBoardSize,
): SlidePuzzleDirection | null {
  if (
    getSlidePuzzleRow(tileIndex, boardSize) ===
    getSlidePuzzleRow(blankIndex, boardSize)
  ) {
    return tileIndex < blankIndex ? "right" : "left";
  }

  if (
    getSlidePuzzleColumn(tileIndex, boardSize) ===
    getSlidePuzzleColumn(blankIndex, boardSize)
  ) {
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
  if (!isSlidePuzzleCellIndex(tileIndex, board)) {
    return null;
  }

  const blankIndex = findSlidePuzzleBlankIndex(board);
  if (tileIndex === blankIndex) {
    return null;
  }

  const boardSize = getSlidePuzzleBoardSize(board);
  const direction = getSlideDirection(tileIndex, blankIndex, boardSize);
  if (!direction) {
    return null;
  }

  const step = -getCellOffset(direction, boardSize);
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
  const boardSize = getSlidePuzzleBoardSize(board);

  return slideDirections
    .map((direction) => blankIndex + getCellOffset(direction, boardSize))
    .filter(
      (cellIndex) =>
        isSlidePuzzleCellIndex(cellIndex, board) &&
        getSlideDirection(cellIndex, blankIndex, boardSize) !== null,
    );
}

/** 押した方向へ、空白の隣のタイルを 1 枚滑らせる。 */
export function getSlidePuzzleKeyboardSlide(
  board: SlidePuzzleBoard,
  direction: SlidePuzzleDirection,
): SlidePuzzleSlide | null {
  const tileIndex =
    findSlidePuzzleBlankIndex(board) -
    getCellOffset(direction, getSlidePuzzleBoardSize(board));
  const slide = getSlidePuzzleSlide(board, tileIndex);

  return slide?.direction === direction ? slide : null;
}

/**
 * 空白を除いたタイル列の転倒数で判定する。幅が奇数の盤面では転倒数が偶数のとき、
 * 幅が偶数の盤面では転倒数と空白が下から何行目にあるかの和が奇数のときに限って、
 * 完成盤面へ到達できる。
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

  const boardSize = getSlidePuzzleBoardSize(board);
  if (boardSize % 2 === 1) {
    return inversionCount % 2 === 0;
  }

  const blankRowFromBottom =
    boardSize - getSlidePuzzleRow(findSlidePuzzleBlankIndex(board), boardSize);

  return (inversionCount + blankRowFromBottom) % 2 === 1;
}
