import {
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedNonogramResult } from "@/game-catalog/nonogram/RecordedNonogramResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/nonogram/assets/pictogram.svg?raw";
import { NONOGRAM_DISPLAY_NAME } from "@/games/nonogram/display-name";
import {
  isNonogramPlayRecord,
  nonogramPlayRecordDefinition,
  restoreNonogramRecordedResult,
} from "@/games/nonogram/play-record";
import { canSelectNonogramProblemById } from "@/games/nonogram/problem-selection";
import { nonogramPlayRecordDisplay } from "@/games/nonogram/ui/play-record-display";

export const nonogramCatalogEntry = {
  id: nonogramPlayRecordDefinition.gameId,
  name: NONOGRAM_DISPLAY_NAME,
  pictogramSvg,
  entryPath: "/puzzles/nonogram",
  playPath: "/puzzles/nonogram/play/:difficulty",
  playRecordDisplay: nonogramPlayRecordDisplay,
  recordProblemPlayTarget(record) {
    return isNonogramPlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseDifficultyLevel(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectNonogramProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseDifficultyLevel(start.difficulty),
      start.problemIdentity,
      canSelectNonogramProblemById,
    );
  },
  renderRecordResult(record, context) {
    const recorded = restoreNonogramRecordedResult(record);
    return recorded ? (
      <RecordedNonogramResult {...recorded} {...context} />
    ) : null;
  },
} satisfies GameCatalogEntry;
