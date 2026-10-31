import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";
import pictogramSvg from "@/games/ice-floor-maze/assets/pictogram.svg?raw";
import { ICE_FLOOR_MAZE_DISPLAY_NAME } from "@/games/ice-floor-maze/display-name";

/**
 * ゲーム選択への掲載と、入口・プレイ画面の間の遷移に要る分だけのカタログ項目。
 * 記録の定義と記録の結果画面が無いので `gameCatalog` には載せず、ゲーム選択は `PuzzleSelectionView` が末尾に足す。
 */
export const iceFloorMazeCatalogEntry = {
  name: ICE_FLOOR_MAZE_DISPLAY_NAME,
  pictogramSvg,
  entryPath: "/puzzles/ice-floor-maze",
  playPath: "/puzzles/ice-floor-maze/play/:difficulty",
} satisfies Pick<
  GameCatalogEntry,
  "name" | "pictogramSvg" | "entryPath" | "playPath"
>;
