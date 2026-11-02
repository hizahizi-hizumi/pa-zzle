import type { TsumeShogiSquare } from "@/games/tsume-shogi/puzzle/position";

const BOARD_SIZE = 9;
/** 成・不成の選択肢は、横に升2つ分、縦に升1つ分を覆う。 */
const PICKER_COLUMNS = 2;

/** 選択肢の左上の升。左端の列（0 が9筋）と上端の段（0 が一段目）。選択肢は升の境界にそろい、ちょうど升2つを覆う。 */
export type TsumeShogiPromotionPickerPlacement = {
  column: number;
  row: number;
};

/**
 * 成・不成の選択肢の位置。移動先の升の真上の段に置き、盤の上にはみ出すとき（一段目）だけ真下の段に置く。
 * 左の「成」を移動先と同じ筋にそろえ、盤の右端（1筋）だけは右の「不成」をそろえる。
 * 升の途中で切れて駒が半分だけ見えることがないよう、升の境界にそろえる。移動先の升は覆わない。
 * 周りの駒は避けず、位置が場面で変わらないことを優先する。
 */
export function placeTsumeShogiPromotionPicker(
  to: TsumeShogiSquare,
): TsumeShogiPromotionPickerPlacement {
  const row = to.rank - 1;
  const column = BOARD_SIZE - to.file;
  return {
    column: Math.min(column, BOARD_SIZE - PICKER_COLUMNS),
    row: row > 0 ? row - 1 : row + 1,
  };
}
