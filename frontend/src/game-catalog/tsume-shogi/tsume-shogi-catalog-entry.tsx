import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";
import pictogramSvg from "@/games/tsume-shogi/assets/pictogram.svg?raw";
import { TSUME_SHOGI_DISPLAY_NAME } from "@/games/tsume-shogi/display-name";
import { tsumeShogiPlayRecordDefinition } from "@/games/tsume-shogi/play-record";
import { tsumeShogiPlayRecordDisplay } from "@/games/tsume-shogi/ui/play-record-display";

// 問題IDでの遊び直しと記録から描く結果画面は、プレイ画面を問題IDの URL と記録の結果画面へつないでから返す。
export const tsumeShogiCatalogEntry = {
  id: tsumeShogiPlayRecordDefinition.gameId,
  name: TSUME_SHOGI_DISPLAY_NAME,
  pictogramSvg,
  entryPath: "/puzzles/tsume-shogi",
  playPath: "/puzzles/tsume-shogi/play/:difficulty",
  playRecordDisplay: tsumeShogiPlayRecordDisplay,
  recordProblemPlayTarget() {
    return null;
  },
  renderRecordResult() {
    return null;
  },
} satisfies GameCatalogEntry;
