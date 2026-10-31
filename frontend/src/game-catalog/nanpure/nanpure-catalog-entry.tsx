import {
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedNanpureResult } from "@/game-catalog/nanpure/RecordedNanpureResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/nanpure/assets/pictogram.svg?raw";
import { NANPURE_DISPLAY_NAME } from "@/games/nanpure/display-name";
import {
  isNanpurePlayRecord,
  nanpurePlayRecordDefinition,
  restoreNanpureRecordedResult,
} from "@/games/nanpure/play-record";
import { canSelectNanpureProblemById } from "@/games/nanpure/problem-selection";
import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";

export const nanpureCatalogEntry = {
  id: nanpurePlayRecordDefinition.gameId,
  name: NANPURE_DISPLAY_NAME,
  pictogramSvg,
  entryPath: "/puzzles/nanpure",
  playPath: "/puzzles/nanpure/play/:difficulty",
  playRecordDisplay: nanpurePlayRecordDisplay,
  recordProblemPlayTarget(record) {
    return isNanpurePlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseDifficultyLevel(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectNanpureProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseDifficultyLevel(start.difficulty),
      start.problemIdentity,
      canSelectNanpureProblemById,
    );
  },
  renderRecordResult(record, context) {
    const recorded = restoreNanpureRecordedResult(record);
    return recorded ? (
      <RecordedNanpureResult {...recorded} {...context} />
    ) : null;
  },
} satisfies GameCatalogEntry;
