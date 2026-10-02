import {
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import pictogramSvg from "@/games/takuzu/assets/pictogram.svg?raw";
import { parseTakuzuDifficulty } from "@/games/takuzu/difficulty";
import {
  isTakuzuPlayRecord,
  takuzuPlayRecordDefinition,
} from "@/games/takuzu/play-record";
import { canSelectTakuzuProblemById } from "@/games/takuzu/problem-selection";
import { takuzuPlayRecordDisplay } from "@/games/takuzu/ui/play-record-display";

export const takuzuCatalogEntry = {
  id: takuzuPlayRecordDefinition.gameId,
  name: "バイナリパズル",
  pictogramSvg,
  entryPath: "/puzzles/takuzu",
  playPath: "/puzzles/takuzu/play/:difficulty",
  playRecordDisplay: takuzuPlayRecordDisplay,
  recordProblemPlayTarget(record) {
    return isTakuzuPlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseTakuzuDifficulty(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectTakuzuProblemById,
        )
      : null;
  },
} satisfies GameCatalogEntry;
