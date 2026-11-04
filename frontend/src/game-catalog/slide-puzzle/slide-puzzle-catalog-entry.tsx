import {
  createProblemFeatureFilter,
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
import {
  findSlidePuzzlePoolProblemFeatures,
  listSlidePuzzlePoolProblemIds,
  slidePuzzleProblemFeatureAxes,
} from "@/games/slide-puzzle/problem/problem-pool";
import { canSelectSlidePuzzleProblemById } from "@/games/slide-puzzle/problem-selection";
import { slidePuzzlePlayRecordDisplay } from "@/games/slide-puzzle/ui/play-record-display";
import {
  formatSlidePuzzleProblemFeatures,
  slidePuzzleProblemFeatureAxisDisplays,
} from "@/games/slide-puzzle/ui/problem-features";

export const slidePuzzleCatalogEntry = {
  id: slidePuzzlePlayRecordDefinition.gameId,
  name: SLIDE_PUZZLE_DISPLAY_NAME,
  pictogramSvg,
  homePath: "/puzzles/slide-puzzle",
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
  listPoolProblemIds: listSlidePuzzlePoolProblemIds,
  renderRecordResult(record, context) {
    const recorded = restoreSlidePuzzleRecordedResult(record);
    return recorded ? (
      <RecordedSlidePuzzleResult {...recorded} {...context} />
    ) : null;
  },
  describePoolProblem(difficulty, problemId) {
    const features = findSlidePuzzlePoolProblemFeatures(difficulty, problemId);
    return features ? formatSlidePuzzleProblemFeatures(features) : null;
  },
  problemFeatureFilter: createProblemFeatureFilter(
    findSlidePuzzlePoolProblemFeatures,
    slidePuzzleProblemFeatureAxes,
    slidePuzzleProblemFeatureAxisDisplays,
  ),
} satisfies GameCatalogEntry;
