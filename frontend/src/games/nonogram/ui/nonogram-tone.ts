/**
 * ノノグラム固有の色。共通UIの意味色（`primary`・`ring`・`success` など）は流用しない。
 * - `filled`: 塗ったマス。クリアで格子と × が消えると、塗りだけが図柄として残る。
 * - `cross`: × の印。メモなので、塗りより弱く、格子より強い濃さにする。
 * - `gridLine` / `blockLine`: マスの間の線と、5マスごと・外周の線。盤面は SVG の `stroke` で引き、
 *   遊び方の図はマスの隙間の地（`gridLineSurface`）と枠（`blockLineBorder`）で同じ色を描く。
 * - `clue`: ヒントの数字。`matchedClue` は塗りがヒントにちょうど合った行・列の数字で、読めるまま退かせる。
 * - `activeLine`: 押している・キーボードで選んでいるマスの行・列のヒントの地。キーボードで選んでいるマスの輪郭
 *   （`focusOutline`）も同じ色相にする。
 */
export const nonogramToneClassNames = {
  filled: "bg-slate-800 dark:bg-slate-200",
  cross: "text-slate-400 dark:text-slate-500",
  gridLine: "stroke-slate-300 dark:stroke-slate-700",
  blockLine: "stroke-slate-500 dark:stroke-slate-400",
  gridLineSurface: "bg-slate-300 dark:bg-slate-700",
  blockLineBorder: "border-slate-500 dark:border-slate-400",
  clue: "text-foreground",
  matchedClue: "text-slate-300 dark:text-slate-600",
  activeLine: "bg-sky-100 dark:bg-sky-950",
  focusOutline: "focus-visible:outline-sky-500",
} as const;
