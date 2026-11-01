/**
 * ノノグラム固有の色。共通UIの意味色（`primary`・`ring`・`success` など）は流用しない。
 * - `filled`: 塗ったマス。クリアで格子と × が消えると、塗りだけが図柄として残る。
 * - `cross`: × の印。メモなので、塗りより弱く、格子より強い濃さにする。
 * - `gridLine` / `blockLine`: マスの間の線と、5マスごと・外周の線（`border` の色）。遊び方の図は
 *   マスの隙間の地（`gridLineSurface`）で `gridLine` と同じ色を描く。
 * - `clue`: ヒントの数字。`matchedClue` は塗りがヒントにちょうど合った行・列の数字で、読めるまま退かせる。
 * - `activeLine`: 押している・キーボードで選んでいるマスの行・列のヒントの地。キーボードで選んでいるマスの輪郭
 *   （`focusOutline`）と、入れる印に選んでいるボタンの地（`selectedMark`）も同じ色相にする。
 * - `strokeTrace`: 遊び方の図で、指でなぞった道筋。押している行・列と同じ色相で、塗りの上でも見える濃さにする。
 */
export const nonogramToneClassNames = {
  filled: "bg-slate-800 dark:bg-slate-200",
  cross: "text-slate-400 dark:text-slate-500",
  gridLine: "border-slate-300 dark:border-slate-700",
  blockLine: "border-slate-500 dark:border-slate-400",
  gridLineSurface: "bg-slate-300 dark:bg-slate-700",
  clue: "text-foreground",
  matchedClue: "text-slate-300 dark:text-slate-600",
  activeLine: "bg-sky-100 dark:bg-sky-950",
  focusOutline: "focus-visible:outline-sky-500",
  selectedMark: "bg-sky-100 dark:bg-sky-950",
  strokeTrace: "text-sky-500 dark:text-sky-400",
} as const;
