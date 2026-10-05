import {
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedSlidePuzzleResult } from "@/game-catalog/slide-puzzle/RecordedSlidePuzzleResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/slide-puzzle/assets/pictogram.svg?raw";
import { SLIDE_PUZZLE_DISPLAY_NAME } from "@/games/slide-puzzle/display-name";
import {
  isSlidePuzzlePlayRecord,
  restoreSlidePuzzleRecordedResult,
  slidePuzzlePlayRecordDefinition,
} from "@/games/slide-puzzle/play-record";
import { canSelectSlidePuzzleProblemById } from "@/games/slide-puzzle/problem-selection";
import { slidePuzzlePlayRecordDisplay } from "@/games/slide-puzzle/ui/play-record-display";

export const slidePuzzleCatalogEntry = {
  id: slidePuzzlePlayRecordDefinition.gameId,
  name: SLIDE_PUZZLE_DISPLAY_NAME,
  pictogramSvg,
  entryPath: "/puzzles/slide-puzzle",
  playPath: "/puzzles/slide-puzzle/play/:difficulty",
  playRecordDisplay: slidePuzzlePlayRecordDisplay,
  recordProblemPlayTarget(record) {
    return isSlidePuzzlePlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseDifficultyLevel(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectSlidePuzzleProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseDifficultyLevel(start.difficulty),
      start.problemIdentity,
      canSelectSlidePuzzleProblemById,
    );
  },
  renderRecordResult(record, context) {
    const recorded = restoreSlidePuzzleRecordedResult(record);
    return recorded ? (
      <RecordedSlidePuzzleResult {...recorded} {...context} />
    ) : null;
  },
} satisfies GameCatalogEntry;
