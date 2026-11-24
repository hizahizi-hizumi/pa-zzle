import type { MagicSquareLine } from "@/games/magic-square/puzzle/board";

/**
 * 盤の格子。マスの右に行の合計、下に縦の列の合計を置く帯を取り、斜めの合計は帯の角に置く。
 * 左上から右下への斜めは右下の角、右上から左下への斜めは左下の角で、どちらも斜めを盤の外へ延ばした先に当たる。
 * そろえる合計は、左の帯の上の角に置く。帯の幅はマス1つの幅に対する比で、6×6 の 3桁の合計（111）が入る。
 */
export const MAGIC_SQUARE_SUM_BAND_RATIO = 0.8;

/**
 * マスの一辺に対する、くぼみ・札とマスの境の余白。隣り合うマスの間の溝はこの2倍になる。
 * 盤の縁も同じ幅だけマスの外へ張り出させ、縁の厚みを溝とそろえる。
 */
export const MAGIC_SQUARE_CELL_INSET_RATIO = 0.05;
export const MAGIC_SQUARE_SLAB_RIM_RATIO = MAGIC_SQUARE_CELL_INSET_RATIO;

/** 盤面のうち描くマスの範囲。行と列は0始まり。遊び方の例が、盤面の一部だけを描くのに使う。 */
export type MagicSquareBoardRegion = {
  row: number;
  column: number;
  rowCount: number;
  columnCount: number;
};

export function getMagicSquareWholeRegion(
  size: number,
): MagicSquareBoardRegion {
  return { row: 0, column: 0, rowCount: size, columnCount: size };
}

/**
 * 範囲を描くときに取る帯。左の帯（そろえる合計）は範囲が左端の列を含むとき、右の帯（行の合計）は右端の列を含むときに取る。
 * 下の帯（縦の列と斜めの合計）は、盤面の全体を描くときだけ取る。
 */
export function getMagicSquareRegionBands(
  size: number,
  region: MagicSquareBoardRegion,
): { left: boolean; right: boolean; bottom: boolean } {
  return {
    left: region.column === 0,
    right: region.column + region.columnCount === size,
    bottom:
      region.row === 0 &&
      region.column === 0 &&
      region.rowCount === size &&
      region.columnCount === size,
  };
}

/**
 * 盤全体の幅と高さを、マスの数で表したもの。盤面の全体では、左右に帯、下に帯を取る。
 * 盤の縁が張り出す分は、左右と下では帯の中に収め、帯の無い上だけ高さに足す。
 */
export function getMagicSquareFrameUnits(
  size: number,
  region: MagicSquareBoardRegion = getMagicSquareWholeRegion(size),
): {
  columns: number;
  rows: number;
} {
  const bands = getMagicSquareRegionBands(size, region);
  return {
    columns:
      region.columnCount +
      MAGIC_SQUARE_SUM_BAND_RATIO * (Number(bands.left) + Number(bands.right)),
    rows:
      region.rowCount +
      (bands.bottom ? MAGIC_SQUARE_SUM_BAND_RATIO : 0) +
      MAGIC_SQUARE_SLAB_RIM_RATIO,
  };
}

/** 格子の行と列（どちらも1始まり）。左の帯を取るときは1列目にし、マスをその次の列から、下の帯を最後の行にする。 */
export type MagicSquareGridArea = { row: number; column: number };

/** マスを並べる盤の面の範囲。盤の面の中では、範囲のマスを1行目・1列目から並べる。 */
export function getMagicSquareSlabArea(
  size: number,
  region: MagicSquareBoardRegion = getMagicSquareWholeRegion(size),
): {
  row: string;
  column: string;
} {
  const { left } = getMagicSquareRegionBands(size, region);
  return {
    row: `1 / span ${region.rowCount}`,
    column: `${left ? 2 : 1} / span ${region.columnCount}`,
  };
}

/** 列の合計を置く所。範囲を描くときは、範囲の行の合計だけを右の帯に置く。 */
export function getMagicSquareLineSumArea(
  size: number,
  line: MagicSquareLine,
  region: MagicSquareBoardRegion = getMagicSquareWholeRegion(size),
): MagicSquareGridArea {
  const { left } = getMagicSquareRegionBands(size, region);
  const rightBandColumn = region.columnCount + (left ? 2 : 1);
  switch (line.kind) {
    case "row":
      return { row: line.index - region.row + 1, column: rightBandColumn };
    case "column":
      return { row: size + 1, column: line.index + 2 };
    case "diagonal":
      return line.from === "top-left"
        ? { row: size + 1, column: size + 2 }
        : { row: size + 1, column: 1 };
  }
}

/** 描く範囲に合計を置ける列か。範囲を描くときは、範囲の行で、右の帯を取るものだけにする。 */
export function isMagicSquareLineSumInRegion(
  size: number,
  line: MagicSquareLine,
  region: MagicSquareBoardRegion,
): boolean {
  const bands = getMagicSquareRegionBands(size, region);
  if (bands.bottom) {
    return true;
  }
  return (
    bands.right &&
    line.kind === "row" &&
    line.index >= region.row &&
    line.index < region.row + region.rowCount
  );
}

/** 範囲のマスか。 */
export function isMagicSquareCellInRegion(
  size: number,
  cellIndex: number,
  region: MagicSquareBoardRegion,
): boolean {
  const row = Math.floor(cellIndex / size);
  const column = cellIndex % size;
  return (
    row >= region.row &&
    row < region.row + region.rowCount &&
    column >= region.column &&
    column < region.column + region.columnCount
  );
}

export const MAGIC_SQUARE_MAGIC_SUM_AREA: MagicSquareGridArea = {
  row: 1,
  column: 1,
};
