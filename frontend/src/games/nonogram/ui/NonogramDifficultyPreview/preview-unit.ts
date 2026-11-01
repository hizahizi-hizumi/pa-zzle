/** マス単位の長さを、プレビューのマスの大きさ（`--preview-unit`）を掛けた CSS の長さにする。 */
export function toPreviewLength(value: number): string {
  return `calc(var(--preview-unit) * ${value})`;
}
