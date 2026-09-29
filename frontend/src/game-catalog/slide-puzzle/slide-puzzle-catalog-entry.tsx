import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";
import pictogramSvg from "@/games/slide-puzzle/assets/pictogram.svg?raw";
import { slidePuzzlePlayRecordDefinition } from "@/games/slide-puzzle/play-record";
import { slidePuzzlePlayRecordDisplay } from "@/games/slide-puzzle/ui/play-record-display";

export const slidePuzzleCatalogEntry = {
  id: slidePuzzlePlayRecordDefinition.gameId,
  name: "スライドパズル",
  pictogramSvg,
  entryPath: "/puzzles/slide-puzzle",
  playRecordDisplay: slidePuzzlePlayRecordDisplay,
} satisfies GameCatalogEntry;
