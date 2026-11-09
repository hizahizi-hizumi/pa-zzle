/**
 * 押せるマスのボタンの見た目。押したとき・マウスを重ねたとき・フォーカスしたときの地と輪郭を、盤面と遊び方の図で同じにする。
 * 最初からあるタイルのマス（`aria-disabled`）と押せない盤面（`disabled`）では、地を変えない。
 */
export const takuzuCellButtonClassName =
  "touch-manipulation select-none outline-none transition-colors duration-(--duration-fast) focus-visible:z-10 focus-visible:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground/70 disabled:cursor-default enabled:not-aria-disabled:hover:bg-accent/60 enabled:not-aria-disabled:active:bg-accent";

/**
 * 押せない図で、そのコマで押したマスに付ける見た目。本番の盤面でキーボードで選んでいるマス（フォーカスしたマス）と同じ地と輪郭にする。
 * `takuzuCellButtonClassName` の `focus-visible:` の見た目と同じ値にする。
 */
export const takuzuCurrentCellClassName =
  "z-10 bg-accent outline-2 -outline-offset-2 outline-foreground/70";
