import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";
import pictogramSvg from "@/games/takuzu/assets/pictogram.svg?raw";
import { takuzuPlayRecordDefinition } from "@/games/takuzu/play-record";
import { takuzuPlayRecordDisplay } from "@/games/takuzu/ui/play-record-display";

export const takuzuCatalogEntry = {
  id: takuzuPlayRecordDefinition.gameId,
  name: "バイナリパズル",
  pictogramSvg,
  entryPath: "/puzzles/takuzu",
  playRecordDisplay: takuzuPlayRecordDisplay,
} satisfies GameCatalogEntry;
