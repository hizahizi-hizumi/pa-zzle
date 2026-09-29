import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";
import pictogramSvg from "@/games/parking-jam/assets/pictogram.svg?raw";
import { parkingJamPlayRecordDefinition } from "@/games/parking-jam/play-record";
import { parkingJamPlayRecordDisplay } from "@/games/parking-jam/ui/play-record-display";

export const parkingJamCatalogEntry = {
  id: parkingJamPlayRecordDefinition.gameId,
  name: "パーキングジャム",
  pictogramSvg,
  entryPath: "/puzzles/parking-jam",
  playRecordDisplay: parkingJamPlayRecordDisplay,
} satisfies GameCatalogEntry;
