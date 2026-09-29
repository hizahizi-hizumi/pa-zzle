import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";
import pictogramSvg from "@/games/nanpure/assets/pictogram.svg?raw";
import { nanpurePlayRecordDefinition } from "@/games/nanpure/play-record";
import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";

export const nanpureCatalogEntry = {
  id: nanpurePlayRecordDefinition.gameId,
  name: "ナンプレ",
  pictogramSvg,
  entryPath: "/puzzles/nanpure",
  playRecordDisplay: nanpurePlayRecordDisplay,
} satisfies GameCatalogEntry;
