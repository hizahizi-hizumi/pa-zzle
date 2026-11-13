/**
 * 遊び方のキーボードの表の、左にキーを、右に説明を置く2列。
 * キーボードのキーと説明の書き出しを、どの行でも同じ所にそろえる。
 * 左の列は、キーの表でいちばん長いキーの組が1行に収まる幅にする。
 */
export const howToPlayLabelColumnsClassName =
  "grid-cols-[--spacing(40)_minmax(0,1fr)] gap-x-4";

/**
 * 操作の行の、左にアイコン、右に文を置く2列。アイコンの列はプレイ画面の丸いボタン（48px）の幅にし、
 * 待ったとメニューの各操作の文の書き出しを1本の線にそろえる。アイコンは列の中央に置く。
 */
export const howToPlayOperationColumnsClassName =
  "grid grid-cols-[--spacing(12)_minmax(0,1fr)] gap-x-4 [&>:first-child]:justify-self-center";
