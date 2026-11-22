import {
  type MagicSquareBoard,
  parseMagicSquareBoard,
} from "@/games/magic-square/puzzle/board";

/** 遊び方の図の盤面。どれもレベル1の問題と同じ 4×4 の最初の数に、数を置いた盤面。 */
export type MagicSquareFigureBoard = {
  givens: MagicSquareBoard;
  board: MagicSquareBoard;
  selectedCellIndex: number | null;
};

const givens = parseMagicSquareBoard([
  ". 4 5 .",
  ". 2 . .",
  ". . 12 1",
  "3 . 10 6",
]);

function createFigureBoard(
  rows: readonly string[],
  selectedCellIndex: number | null = null,
): MagicSquareFigureBoard {
  return { givens, board: parseMagicSquareBoard(rows), selectedCellIndex };
}

export const goalFigureBoard = createFigureBoard([
  "14 4 5 11",
  "9 2 7 16",
  "8 13 12 1",
  "3 15 10 6",
]);

/** 左上に 14 を置き、左上のマスを選んだ盤面。1行目・1列目・左上からの斜めが明るくなる。 */
export const selectedFigureBoard = createFigureBoard(
  ["14 4 5 .", ". 2 . .", ". . 12 1", "3 . 10 6"],
  0,
);

/** 1行目が埋まったのに、合計が 36 になった盤面。 */
export const unmatchedFigureBoard = createFigureBoard([
  "14 4 5 13",
  ". 2 . .",
  ". . 12 1",
  "3 . 10 6",
]);

/** 1列目に空きがあるのに、合計が 34 に届いた盤面。 */
export const overreachedFigureBoard = createFigureBoard([
  "15 4 5 .",
  "16 2 . .",
  ". . 12 1",
  "3 . 10 6",
]);
