/**
 * 違反の印の色。盤面と遊び方の図で同じ見え方にする。
 * 共通の `error` 色ではなく、盤面の中だけで使うゲーム固有の色にし、平常時の盤面を騒がしくしないよう控えめに付ける。
 */

/** 3連続のマスの地の色。 */
export const runViolationCellClassName = "bg-rose-100/80 dark:bg-rose-950/50";

/** 個数超過・重複の行・列の、盤面の縁の外に置く細い線の色。 */
export const lineViolationBarClassName =
  "rounded-full bg-rose-400 dark:bg-rose-400/80";
