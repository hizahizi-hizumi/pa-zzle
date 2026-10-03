import type {
  GameCatalogEntry,
  GamePlayPath,
  RecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { minesweeperCatalogEntry } from "@/game-catalog/minesweeper/minesweeper-catalog-entry";
import { nanpureCatalogEntry } from "@/game-catalog/nanpure/nanpure-catalog-entry";
import { parkingJamCatalogEntry } from "@/game-catalog/parking-jam/parking-jam-catalog-entry";
import { reflectionCatalogEntry } from "@/game-catalog/reflection/reflection-catalog-entry";
import { slidePuzzleCatalogEntry } from "@/game-catalog/slide-puzzle/slide-puzzle-catalog-entry";
import { takuzuCatalogEntry } from "@/game-catalog/takuzu/takuzu-catalog-entry";
import { waterSortCatalogEntry } from "@/game-catalog/water-sort/water-sort-catalog-entry";
import type { PlayRecord } from "@/records/play-record";

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

/** 記録の問題を遊び直すプレイ画面。 */
export type RecordProblemPlayDestination = RecordProblemPlayTarget & {
  playPath: GamePlayPath;
};

/** 記録の問題を遊び直すプレイ画面を求める。今のアプリに無いゲームの記録や、遊び直せない記録には `null` を返す。 */
export function findRecordProblemPlayDestination(
  record: PlayRecord,
): RecordProblemPlayDestination | null {
  const game = findGameCatalogEntry(record.gameId);
  const target = game?.recordProblemPlayTarget(record);
  return game && target ? { ...target, playPath: game.playPath } : null;
}
