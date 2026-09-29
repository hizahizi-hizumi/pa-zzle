import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";
import pictogramSvg from "@/games/water-sort/assets/pictogram.svg?raw";
import { waterSortPlayRecordDefinition } from "@/games/water-sort/play-record";
import { waterSortPlayRecordDisplay } from "@/games/water-sort/ui/play-record-display";

export const waterSortCatalogEntry = {
  id: waterSortPlayRecordDefinition.gameId,
  name: "ウォーターソート",
  pictogramSvg,
  entryPath: "/puzzles/water-sort",
  playRecordDisplay: waterSortPlayRecordDisplay,
} satisfies GameCatalogEntry;
