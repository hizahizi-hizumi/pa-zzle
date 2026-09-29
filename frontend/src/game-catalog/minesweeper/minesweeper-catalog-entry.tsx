import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";
import pictogramSvg from "@/games/minesweeper/assets/pictogram.svg?raw";
import { minesweeperPlayRecordDefinition } from "@/games/minesweeper/play-record";
import { minesweeperPlayRecordDisplay } from "@/games/minesweeper/ui/play-record-display";

export const minesweeperCatalogEntry = {
  id: minesweeperPlayRecordDefinition.gameId,
  name: "マインスイーパー",
  pictogramSvg,
  entryPath: "/puzzles/minesweeper",
  playRecordDisplay: minesweeperPlayRecordDisplay,
} satisfies GameCatalogEntry;
