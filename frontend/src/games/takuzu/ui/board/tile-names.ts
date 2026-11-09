import type { TakuzuTile } from "@/games/takuzu/puzzle/board";

/** 画面の文と読み上げで使う、タイルの呼び名。 */
export const takuzuTileNames = {
  a: "四角",
  b: "丸",
} as const satisfies Record<TakuzuTile, string>;
