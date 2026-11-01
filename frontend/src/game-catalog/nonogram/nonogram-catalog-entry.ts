import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";

/**
 * ノノグラムの入口とプレイ画面。記録・結果画面・ピクトグラムをつながないので `gameCatalog` には載せず、
 * パズル選択・記録の画面には出さない。入口とプレイ画面は URL で直接開ける。
 */
export const nonogramCatalogEntry = {
  entryPath: "/puzzles/nonogram",
  playPath: "/puzzles/nonogram/play/:difficulty",
} as const satisfies Pick<GameCatalogEntry, "entryPath" | "playPath">;
