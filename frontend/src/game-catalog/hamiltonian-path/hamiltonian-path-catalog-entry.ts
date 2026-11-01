import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";

/**
 * ハミルトン路の入口とプレイ画面。記録・結果画面・ピクトグラムをつなぐまでは `gameCatalog` に載せず、
 * パズル選択・記録の画面には出さない。入口とプレイ画面は URL で直接開ける。
 */
export const hamiltonianPathCatalogEntry = {
  id: "hamiltonian-path",
  entryPath: "/puzzles/hamiltonian-path",
  playPath: "/puzzles/hamiltonian-path/play/:difficulty",
} as const satisfies Pick<GameCatalogEntry, "id" | "entryPath" | "playPath">;
