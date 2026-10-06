import {
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedReflectionResult } from "@/game-catalog/reflection/RecordedReflectionResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/reflection/assets/pictogram.svg?raw";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import {
  isReflectionPlayRecord,
  reflectionPlayRecordDefinition,
  restoreReflectionRecordedResult,
} from "@/games/reflection/play-record";
import { canSelectReflectionProblemById } from "@/games/reflection/problem-selection";
import { reflectionPlayRecordDisplay } from "@/games/reflection/ui/play-record-display";

export const reflectionCatalogEntry = {
  id: reflectionPlayRecordDefinition.gameId,
  name: REFLECTION_DISPLAY_NAME,
  pictogramSvg,
  entryPath: "/puzzles/reflection",
  playPath: "/puzzles/reflection/play/:difficulty",
  playRecordDisplay: reflectionPlayRecordDisplay,
  recordProblemPlayTarget(record) {
    return isReflectionPlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseDifficultyLevel(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectReflectionProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseDifficultyLevel(start.difficulty),
      start.problemIdentity,
      canSelectReflectionProblemById,
    );
  },
  renderRecordResult(record, context) {
    const recorded = restoreReflectionRecordedResult(record);
    return recorded ? (
      <RecordedReflectionResult {...recorded} {...context} />
    ) : null;
  },
} satisfies GameCatalogEntry;
