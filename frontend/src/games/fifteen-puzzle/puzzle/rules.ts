import {
  FIFTEEN_PUZZLE_BLANK,
  FIFTEEN_PUZZLE_CELL_COUNT,
  FIFTEEN_PUZZLE_SIZE,
  type FifteenPuzzleBoard,
  findFifteenPuzzleBlankIndex,
  getFifteenPuzzleColumn,
  getFifteenPuzzleRow,
  isStandardFifteenPuzzleBoard,
} from "@/games/fifteen-puzzle/puzzle/state";

/** タイルが動く向き。 */
export type FifteenPuzzleDirection = "up" | "down" | "left" | "right";

export type FifteenPuzzleSlide = {
  direction: FifteenPuzzleDirection;
  /** 動く前のマス index。空白に近い順に並ぶ。 */
  movedTileIndices: readonly number[];
};

const cellOffsetByDirection: Record<FifteenPuzzleDirection, number> = {
  up: -FIFTEEN_PUZZLE_SIZE,
  down: FIFTEEN_PUZZLE_SIZE,
  left: -1,
  right: 1,
};

function isFifteenPuzzleCellIndex(cellIndex: number): boolean {
  return (
    Number.isInteger(cellIndex) &&
    cellIndex >= 0 &&
    cellIndex < FIFTEEN_PUZZLE_CELL_COUNT
  );
}

function getSlideDirection(
  tileIndex: number,
  blankIndex: number,
): FifteenPuzzleDirection | null {
  if (getFifteenPuzzleRow(tileIndex) === getFifteenPuzzleRow(blankIndex)) {
    return tileIndex < blankIndex ? "right" : "left";
  }

  if (
    getFifteenPuzzleColumn(tileIndex) === getFifteenPuzzleColumn(blankIndex)
  ) {
    return tileIndex < blankIndex ? "down" : "up";
  }

  return null;
}

/**
 * 空白と同じ行・列にあるタイルから空白までのタイルを、まとめて空白側へ 1 マスずつ滑らせる。
 * 空白と同じ行・列にないマスや空白自体では成立しない。
 */
export function getFifteenPuzzleSlide(
  board: FifteenPuzzleBoard,
  tileIndex: number,
): FifteenPuzzleSlide | null {
  if (!isFifteenPuzzleCellIndex(tileIndex)) {
    return null;
  }

  const blankIndex = findFifteenPuzzleBlankIndex(board);
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

export function applyFifteenPuzzleSlide(
  board: FifteenPuzzleBoard,
  slide: FifteenPuzzleSlide,
): FifteenPuzzleBoard {
  const nextBoard = [...board];
  let blankIndex = findFifteenPuzzleBlankIndex(board);
  for (const tileIndex of slide.movedTileIndices) {
    nextBoard[blankIndex] = board[tileIndex] ?? FIFTEEN_PUZZLE_BLANK;
    blankIndex = tileIndex;
  }
  nextBoard[blankIndex] = FIFTEEN_PUZZLE_BLANK;

  return nextBoard;
}

/** 空白に隣接し、1 枚だけで滑らせられるタイルのマス index。 */
export function listFifteenPuzzleSingleMoves(
  board: FifteenPuzzleBoard,
): number[] {
  const blankIndex = findFifteenPuzzleBlankIndex(board);

  return Object.values(cellOffsetByDirection)
    .map((offset) => blankIndex + offset)
    .filter(
      (cellIndex) =>
        isFifteenPuzzleCellIndex(cellIndex) &&
        getSlideDirection(cellIndex, blankIndex) !== null,
    );
}

/** 押した方向へ、空白の隣のタイルを 1 枚滑らせる。 */
export function getFifteenPuzzleKeyboardSlide(
  board: FifteenPuzzleBoard,
  direction: FifteenPuzzleDirection,
): FifteenPuzzleSlide | null {
  const tileIndex =
    findFifteenPuzzleBlankIndex(board) - cellOffsetByDirection[direction];
  const slide = getFifteenPuzzleSlide(board, tileIndex);

  return slide?.direction === direction ? slide : null;
}

/**
 * 幅が偶数の盤面では、空白を除いたタイル列の転倒数と、空白が下から何行目にあるかの和が
 * 奇数のときに限って完成盤面へ到達できる。
 */
export function isSolvableFifteenPuzzleBoard(
  board: FifteenPuzzleBoard,
): boolean {
  if (!isStandardFifteenPuzzleBoard(board)) {
    return false;
  }

  const tiles = board.filter((tile) => tile !== FIFTEEN_PUZZLE_BLANK);
  let inversionCount = 0;
  for (const [index, tile] of tiles.entries()) {
    for (const laterTile of tiles.slice(index + 1)) {
      if (tile > laterTile) {
        inversionCount += 1;
      }
    }
  }

  const blankRowFromBottom =
    FIFTEEN_PUZZLE_SIZE -
    getFifteenPuzzleRow(findFifteenPuzzleBlankIndex(board));

  return (inversionCount + blankRowFromBottom) % 2 === 1;
}
