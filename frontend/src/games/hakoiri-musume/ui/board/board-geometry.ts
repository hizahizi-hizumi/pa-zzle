import {
  HAKOIRI_MUSUME_COLUMNS,
  HAKOIRI_MUSUME_ROWS,
  type HakoiriMusumeCellPosition,
  type HakoiriMusumePieceShape,
} from "@/games/hakoiri-musume/puzzle/board";

/** 箱の縁の太さ（マス幅に対する割合）。四辺とも同じ太さで、下の辺だけ出口の2マス分を切り欠く。 */
export const BOX_RIM_CELLS = 0.2;

/** 箱の外形の幅と高さ（マス幅を 1 とする）。 */
export const BOX_WIDTH_CELLS = HAKOIRI_MUSUME_COLUMNS + BOX_RIM_CELLS * 2;
export const BOX_HEIGHT_CELLS = HAKOIRI_MUSUME_ROWS + BOX_RIM_CELLS * 2;

/** 隣り合う駒の間にあける隙間の半分（マス幅に対する割合）。駒どうしの境目を見せる。 */
const PIECE_GAP_CELLS = 0.035;

/** 箱の外形に対する位置と大きさ（%）。 */
export type BoxRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function toPercent(cells: number, total: number): number {
  return (cells / total) * 100;
}

/** 箱の中の、左上 `position` から `columns` 列 × `rows` 行を占める所の、箱の外形に対する位置と大きさ。 */
export function getBoxRect(
  { row, column }: HakoiriMusumeCellPosition,
  { columns, rows }: HakoiriMusumePieceShape,
  inset = 0,
): BoxRect {
  return {
    left: toPercent(BOX_RIM_CELLS + column + inset, BOX_WIDTH_CELLS),
    top: toPercent(BOX_RIM_CELLS + row + inset, BOX_HEIGHT_CELLS),
    width: toPercent(columns - inset * 2, BOX_WIDTH_CELLS),
    height: toPercent(rows - inset * 2, BOX_HEIGHT_CELLS),
  };
}

/** 駒の見た目の位置と大きさ。駒の占めるマスから、隙間の分だけ内側。 */
export function getPieceRect(
  position: HakoiriMusumeCellPosition,
  shape: HakoiriMusumePieceShape,
): BoxRect {
  return getBoxRect(position, shape, PIECE_GAP_CELLS);
}

/** 箱の外形の上の点（外形の左上を原点に、幅・高さを 1 とした割合）を、箱の中のマス幅を 1 とした座標にする。 */
export function toBoxCellPoint(
  xRatio: number,
  yRatio: number,
): { row: number; column: number } {
  return {
    row: yRatio * BOX_HEIGHT_CELLS - BOX_RIM_CELLS,
    column: xRatio * BOX_WIDTH_CELLS - BOX_RIM_CELLS,
  };
}

export function toBoxStyle({ left, top, width, height }: BoxRect) {
  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`,
  };
}
