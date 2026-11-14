import { bridgesCatalogEntry } from "@/app/game-integration/bridges/bridges-catalog-entry";
import type {
  GameCatalogEntry,
  RecordProblemPlayDestination,
} from "@/app/game-integration/game-catalog-entry";
import { hitofudePuzzleCatalogEntry } from "@/app/game-integration/hitofude-puzzle/hitofude-puzzle-catalog-entry";
import { iceFloorMazeCatalogEntry } from "@/app/game-integration/ice-floor-maze/ice-floor-maze-catalog-entry";
import { minesweeperCatalogEntry } from "@/app/game-integration/minesweeper/minesweeper-catalog-entry";
import { nanpureCatalogEntry } from "@/app/game-integration/nanpure/nanpure-catalog-entry";
import { parkingJamCatalogEntry } from "@/app/game-integration/parking-jam/parking-jam-catalog-entry";
import { reflectionCatalogEntry } from "@/app/game-integration/reflection/reflection-catalog-entry";
import { slidePuzzleCatalogEntry } from "@/app/game-integration/slide-puzzle/slide-puzzle-catalog-entry";
import { takuzuCatalogEntry } from "@/app/game-integration/takuzu/takuzu-catalog-entry";
import { tsumeShogiCatalogEntry } from "@/app/game-integration/tsume-shogi/tsume-shogi-catalog-entry";
import { waterSortCatalogEntry } from "@/app/game-integration/water-sort/water-sort-catalog-entry";
import type { PlayAttempt } from "@/features/records/play-attempt";
import type { PlayRecord } from "@/features/records/play-record";

export const gameCatalog = [
  waterSortCatalogEntry,
  nanpureCatalogEntry,
  minesweeperCatalogEntry,
  parkingJamCatalogEntry,
  slidePuzzleCatalogEntry,
  takuzuCatalogEntry,
  reflectionCatalogEntry,
  hitofudePuzzleCatalogEntry,
  iceFloorMazeCatalogEntry,
  tsumeShogiCatalogEntry,
  bridgesCatalogEntry,
] as const satisfies readonly [GameCatalogEntry, ...GameCatalogEntry[]];

export function findGameCatalogEntry(
  gameId: string,
): GameCatalogEntry | undefined {
  return gameCatalog.find((game) => game.id === gameId);
}

export function findRecordProblemPlayDestination(
  record: PlayRecord,
): RecordProblemPlayDestination | null {
  const game = findGameCatalogEntry(record.gameId);
  const target = game?.recordProblemPlayTarget(record);
  return game && target ? { ...target, playPath: game.playPath } : null;
}

export function findAttemptProblemPlayDestination(
  attempt: PlayAttempt,
): RecordProblemPlayDestination | null {
  const game = findGameCatalogEntry(attempt.gameId);
  const target = game?.attemptProblemPlayTarget(attempt);
  return game && target ? { ...target, playPath: game.playPath } : null;
}
