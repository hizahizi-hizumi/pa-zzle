/** 上・左のヒントの欄の幅（マス単位）。盤面はこの幅だけ右下にずらして置く。 */
export const PREVIEW_CLUE_BAND = 1.5;

/** マス単位の長さを、プレビューのマスの大きさ（`--preview-unit`）を掛けた CSS の長さにする。 */
export function toPreviewLength(value: number): string {
  return `calc(var(--preview-unit) * ${value})`;
}
