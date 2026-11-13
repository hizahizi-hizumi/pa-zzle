import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedHitofudePuzzleResult } from "@/game-catalog/hitofude-puzzle/RecordedHitofudePuzzleResult";
import {
  formatSquareBoardRange,
  summarizeLevelsDistinctly,
} from "@/game-catalog/level-summary";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/hitofude-puzzle/assets/pictogram.svg?raw";
import pictogramShowcaseSvg from "@/games/hitofude-puzzle/assets/pictogram-showcase.svg?raw";
import { hitofudePuzzleLevelCombinations } from "@/games/hitofude-puzzle/difficulty";
import { HITOFUDE_PUZZLE_DISPLAY_NAME } from "@/games/hitofude-puzzle/display-name";
import {
  hitofudePuzzlePlayRecordDefinition,
  isHitofudePuzzlePlayRecord,
  restoreHitofudePuzzleRecordedResult,
} from "@/games/hitofude-puzzle/play-record";
import {
  findHitofudePuzzlePoolProblemFeatures,
  hitofudePuzzleProblemFeatureAxes,
  listHitofudePuzzlePoolProblemIds,
} from "@/games/hitofude-puzzle/problem/problem-pool";
import { canSelectHitofudePuzzleProblemById } from "@/games/hitofude-puzzle/problem-selection";
import { hitofudePuzzlePlayRecordDisplay } from "@/games/hitofude-puzzle/ui/play-record-display";
import {
  formatHitofudePuzzleProblemFeatures,
  hitofudePuzzleProblemFeatureAxisDisplays,
} from "@/games/hitofude-puzzle/ui/problem-features";

export const hitofudePuzzleCatalogEntry = {
  id: hitofudePuzzlePlayRecordDefinition.gameId,
  name: HITOFUDE_PUZZLE_DISPLAY_NAME,
  pictogramSvg,
  pictogramShowcaseSvg,
  homePath: "/puzzles/hitofude-puzzle",
  playPath: "/puzzles/hitofude-puzzle/play/:difficulty",
  playRecordDisplay: hitofudePuzzlePlayRecordDisplay,
  levelSummaries: summarizeLevelsDistinctly(
    (difficulty) =>
      formatSquareBoardRange(
        hitofudePuzzleLevelCombinations[difficulty].boardSize,
      ),
    (difficulty) =>
      hitofudePuzzleLevelCombinations[difficulty].lookaheadLoad.minimum >= 3
        ? "先読み多め"
        : "先読み少し",
  ),
  recordProblemPlayTarget(record) {
    return isHitofudePuzzlePlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseDifficultyLevel(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectHitofudePuzzleProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseDifficultyLevel(start.difficulty),
      start.problemIdentity,
      canSelectHitofudePuzzleProblemById,
    );
  },
  listPoolProblemIds: listHitofudePuzzlePoolProblemIds,
  hasRecordResult(record) {
    return restoreHitofudePuzzleRecordedResult(record) !== null;
  },
  renderRecordResult(record, context) {
    const recorded = restoreHitofudePuzzleRecordedResult(record);
    return recorded ? (
      <RecordedHitofudePuzzleResult {...recorded} {...context} />
    ) : null;
  },
  describePoolProblem(difficulty, problemId) {
    const features = findHitofudePuzzlePoolProblemFeatures(
      difficulty,
      problemId,
    );
    return features ? formatHitofudePuzzleProblemFeatures(features) : null;
  },
  problemFeatureFilter: createProblemFeatureFilter(
    findHitofudePuzzlePoolProblemFeatures,
    hitofudePuzzleProblemFeatureAxes,
    hitofudePuzzleProblemFeatureAxisDisplays,
  ),
} satisfies GameCatalogEntry;
