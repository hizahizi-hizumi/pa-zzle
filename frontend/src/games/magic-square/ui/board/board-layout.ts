import type { MagicSquareLine } from "@/games/magic-square/puzzle/board";

/**
 * 盤の格子。マスの右に行の合計、下に縦の列の合計を置く帯を取り、斜めの合計は帯の角に置く。
 * 左上から右下への斜めは右下の角、右上から左下への斜めは左下の角。そろえる合計は、左の帯の上の角に置く。
 * 帯の幅はマス1つの幅に対する比で、6×6 の 3桁の合計（111）が入る。
 */
export const MAGIC_SQUARE_SUM_BAND_RATIO = 0.8;

/** 盤全体の幅と高さを、マスの数で表したもの。左右に帯、下に帯を取る。 */
export function getMagicSquareFrameUnits(size: number): {
  columns: number;
  rows: number;
} {
  return {
    columns: size + MAGIC_SQUARE_SUM_BAND_RATIO * 2,
    rows: size + MAGIC_SQUARE_SUM_BAND_RATIO,
  };
}

/** 格子の行と列（どちらも1始まり）。左の帯を1列目、マスを2列目から、下の帯を最後の行にする。 */
export type MagicSquareGridArea = { row: number; column: number };

export function getMagicSquareCellArea(
  size: number,
  cellIndex: number,
): MagicSquareGridArea {
  return {
    row: Math.floor(cellIndex / size) + 1,
    column: (cellIndex % size) + 2,
  };
}

export function getMagicSquareLineSumArea(
  size: number,
  line: MagicSquareLine,
): MagicSquareGridArea {
  switch (line.kind) {
    case "row":
      return { row: line.index + 1, column: size + 2 };
    case "column":
      return { row: size + 1, column: line.index + 2 };
    case "diagonal":
      return line.from === "top-left"
        ? { row: size + 1, column: size + 2 }
        : { row: size + 1, column: 1 };
  }
}

export const MAGIC_SQUARE_MAGIC_SUM_AREA: MagicSquareGridArea = {
  row: 1,
  column: 1,
};
