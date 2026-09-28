import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";
import { minesweeperCatalogEntry } from "@/game-catalog/minesweeper/minesweeper-catalog-entry";
import { nanpureCatalogEntry } from "@/game-catalog/nanpure/nanpure-catalog-entry";
import { parkingJamCatalogEntry } from "@/game-catalog/parking-jam/parking-jam-catalog-entry";
import { reflectionCatalogEntry } from "@/game-catalog/reflection/reflection-catalog-entry";
import { slidePuzzleCatalogEntry } from "@/game-catalog/slide-puzzle/slide-puzzle-catalog-entry";
import { takuzuCatalogEntry } from "@/game-catalog/takuzu/takuzu-catalog-entry";
import { waterSortCatalogEntry } from "@/game-catalog/water-sort/water-sort-catalog-entry";

/** アプリが提供するゲームを、パズル選択と記録で見せる順に並べる。 */
export const gameCatalog = [
  waterSortCatalogEntry,
  nanpureCatalogEntry,
  minesweeperCatalogEntry,
  parkingJamCatalogEntry,
  slidePuzzleCatalogEntry,
  takuzuCatalogEntry,
  reflectionCatalogEntry,
] as const satisfies readonly [GameCatalogEntry, ...GameCatalogEntry[]];

export function findGameCatalogEntry(
  gameId: string,
): GameCatalogEntry | undefined {
  return gameCatalog.find((game) => game.id === gameId);
}
