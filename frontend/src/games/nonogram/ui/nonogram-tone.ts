/**
 * ノノグラム固有の色。共通UIの意味色（`primary`・`ring`・`success` など）は流用しない。
 * - `filled`: 塗ったマス。クリアで格子と × が消えると、塗りだけが図柄として残る。
 * - `cross`: × の印。メモなので、塗りより弱く、格子より強い濃さにする。地との輝度比はライトとダークでそろえ、
 *   `matchedClue` より弱くする。同じ色にすると、ちょうど合って退いたヒントと × が同じ意味の色に見える。
 * - `gridLine` / `blockLine`: マスの間の線と、5マスごと・外周の線（`border` の色）。遊び方の図は
 *   マスの隙間の地（`gridLineSurface`）で `gridLine` と同じ色を描く。線は無彩色にする。色味のある 1px の線は、
 *   画像の変換や画面の共有で色の解像度を落とされると、画素の位置によって色味が残る線と灰色になる線に分かれて見える。
 * - `clue`: ヒントの数字。`matchedClue` は塗りがヒントにちょうど合った行・列の数字で、読めるまま退かせる。
 *   地とも `clue` とも輝度比が 4:1 を超える、両者の中間の濃さにする。
 * - `activeLine`: 押している・キーボードで選んでいるマスの行・列のヒントの地。キーボードで選んでいるマスの輪郭
 *   （`focusOutline`）と、入れる印に選んでいるボタンの地（`selectedMark`）も同じ色相にする。
 * - `strokeTrace`: 遊び方の図で、指でなぞった道筋。押している行・列と同じ色相で、塗りの上でも見える濃さにする。
 * - `previewChain`: 難易度プレビューで、読んで決まるマスをたどる連鎖の線。`activeLine` と同じ色相で、小さな図でも
 *   盤面の外周と格子より先に目に入るよう濃くする。
 */
export const nonogramToneClassNames = {
  filled: "bg-slate-800 dark:bg-slate-200",
  cross: "text-slate-400 dark:text-slate-600",
  gridLine: "border-neutral-300 dark:border-neutral-700",
  blockLine: "border-neutral-500 dark:border-neutral-400",
  gridLineSurface: "bg-neutral-300 dark:bg-neutral-700",
  clue: "text-foreground",
  matchedClue: "text-slate-500",
  activeLine: "bg-sky-100 dark:bg-sky-950",
  focusOutline: "focus-visible:outline-sky-500",
  selectedMark: "bg-sky-100 dark:bg-sky-950",
  strokeTrace: "text-sky-500 dark:text-sky-400",
  previewChain: "text-sky-500 dark:text-sky-400",
} as const;
