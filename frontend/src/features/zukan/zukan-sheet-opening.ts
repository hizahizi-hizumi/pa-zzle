/**
 * パズル選択の額から入るときに、ゲームのホームの台紙へ渡す、見せ始める行。
 * 額の中の台紙は縦に送れるので、額で見ていた所からそのまま開くよう、入る直前の位置を渡す。行の途中から見せることもあるので、小数で持つ。
 */
let openingRow = 0;

export function handOpeningZukanSheetRow(row: number): void {
  openingRow = row;
}

/** 渡された、台紙を見せ始める行。渡されていなければ 0。 */
export function peekOpeningZukanSheetRow(): number {
  return openingRow;
}

export function clearOpeningZukanSheetRow(): void {
  openingRow = 0;
}
