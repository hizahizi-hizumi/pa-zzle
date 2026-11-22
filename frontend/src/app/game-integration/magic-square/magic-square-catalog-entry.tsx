import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/app/game-integration/game-catalog-entry";
import { RecordedMagicSquareResult } from "@/app/game-integration/magic-square/RecordedMagicSquareResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/magic-square/assets/pictogram.svg?raw";
import { MAGIC_SQUARE_DISPLAY_NAME } from "@/games/magic-square/display-name";
import {
  isMagicSquarePlayRecord,
  magicSquarePlayRecordDefinition,
  restoreMagicSquareRecordedResult,
} from "@/games/magic-square/play-record";
import {
  findMagicSquarePoolProblemFeatures,
  listMagicSquarePoolProblemIds,
  magicSquareProblemFeatureAxes,
} from "@/games/magic-square/problem/problem-pool";
import { canSelectMagicSquareProblemById } from "@/games/magic-square/problem-selection";
import { magicSquarePlayRecordDisplay } from "@/games/magic-square/ui/play-record-display";
import {
  formatMagicSquareProblemFeatures,
  magicSquareProblemFeatureAxisDisplays,
} from "@/games/magic-square/ui/problem-features";

export const magicSquareCatalogEntry = {
  id: magicSquarePlayRecordDefinition.gameId,
  name: MAGIC_SQUARE_DISPLAY_NAME,
  pictogramSvg,
  homePath: "/puzzles/magic-square",
  playPath: "/puzzles/magic-square/play/:problemId",
  playRecordDisplay: magicSquarePlayRecordDisplay,
  recordProblemPlayTarget(record) {
    return isMagicSquarePlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseDifficultyLevel(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectMagicSquareProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseDifficultyLevel(start.difficulty),
      start.problemIdentity,
      canSelectMagicSquareProblemById,
    );
  },
  listPoolProblemIds: listMagicSquarePoolProblemIds,
  hasRecordResult(record) {
    return restoreMagicSquareRecordedResult(record) !== null;
  },
  renderRecordResult(record, context) {
    const recorded = restoreMagicSquareRecordedResult(record);
    return recorded ? (
      <RecordedMagicSquareResult {...recorded} {...context} />
    ) : null;
  },
  describePoolProblem(difficulty, problemId) {
    const features = findMagicSquarePoolProblemFeatures(difficulty, problemId);
    return features ? formatMagicSquareProblemFeatures(features) : null;
  },
  problemFeatureFilter: createProblemFeatureFilter(
    findMagicSquarePoolProblemFeatures,
    magicSquareProblemFeatureAxes,
    magicSquareProblemFeatureAxisDisplays,
  ),
} satisfies GameCatalogEntry;
