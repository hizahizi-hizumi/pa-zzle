import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import {
  formatRange,
  summarizeLevelsDistinctly,
} from "@/game-catalog/level-summary";
import { RecordedSlidePuzzleResult } from "@/game-catalog/slide-puzzle/RecordedSlidePuzzleResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/slide-puzzle/assets/pictogram.svg?raw";
import pictogramShowcaseSvg from "@/games/slide-puzzle/assets/pictogram-showcase.svg?raw";
import { slidePuzzleDifficultyCriteria } from "@/games/slide-puzzle/difficulty";
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
  pictogramShowcaseSvg,
  homePath: "/puzzles/slide-puzzle",
  playPath: "/puzzles/slide-puzzle/play/:difficulty",
  playRecordDisplay: slidePuzzlePlayRecordDisplay,
  levelSummaries: summarizeLevelsDistinctly(
    (difficulty) => {
      const { boardSize } = slidePuzzleDifficultyCriteria[difficulty];
      return `${boardSize}×${boardSize}`;
    },
    (difficulty) =>
      `遠回り${formatRange(slidePuzzleDifficultyCriteria[difficulty].detourMoveCount)}`,
  ),
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
  hasRecordResult(record) {
    return restoreSlidePuzzleRecordedResult(record) !== null;
  },
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
