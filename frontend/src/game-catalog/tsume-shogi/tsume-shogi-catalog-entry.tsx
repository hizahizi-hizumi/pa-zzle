import {
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedTsumeShogiResult } from "@/game-catalog/tsume-shogi/RecordedTsumeShogiResult";
import pictogramSvg from "@/games/tsume-shogi/assets/pictogram.svg?raw";
import { parseTsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import { TSUME_SHOGI_DISPLAY_NAME } from "@/games/tsume-shogi/display-name";
import {
  isTsumeShogiPlayRecord,
  restoreTsumeShogiRecordedResult,
  tsumeShogiPlayRecordDefinition,
} from "@/games/tsume-shogi/play-record";
import { canSelectTsumeShogiProblemById } from "@/games/tsume-shogi/problem-selection";
import { tsumeShogiPlayRecordDisplay } from "@/games/tsume-shogi/ui/play-record-display";

export const tsumeShogiCatalogEntry = {
  id: tsumeShogiPlayRecordDefinition.gameId,
  name: TSUME_SHOGI_DISPLAY_NAME,
  pictogramSvg,
  entryPath: "/puzzles/tsume-shogi",
  playPath: "/puzzles/tsume-shogi/play/:difficulty",
  playRecordDisplay: tsumeShogiPlayRecordDisplay,
  recordProblemPlayTarget(record) {
    return isTsumeShogiPlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseTsumeShogiDifficulty(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectTsumeShogiProblemById,
        )
      : null;
  },
  renderRecordResult(record, context) {
    const recorded = restoreTsumeShogiRecordedResult(record);
    return recorded ? (
      <RecordedTsumeShogiResult {...recorded} {...context} />
    ) : null;
  },
} satisfies GameCatalogEntry;
