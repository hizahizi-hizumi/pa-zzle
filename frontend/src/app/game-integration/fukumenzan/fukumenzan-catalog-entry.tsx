import { RecordedFukumenzanResult } from "@/app/game-integration/fukumenzan/RecordedFukumenzanResult";
import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/app/game-integration/game-catalog-entry";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/fukumenzan/assets/pictogram.svg?raw";
import { FUKUMENZAN_DISPLAY_NAME } from "@/games/fukumenzan/display-name";
import {
  fukumenzanPlayRecordDefinition,
  isFukumenzanPlayRecord,
  restoreFukumenzanRecordedResult,
} from "@/games/fukumenzan/play-record";
import {
  findFukumenzanPoolProblemFeatures,
  fukumenzanProblemFeatureAxes,
  listFukumenzanPoolProblemIds,
} from "@/games/fukumenzan/problem/problem-pool";
import { canSelectFukumenzanProblemById } from "@/games/fukumenzan/problem-selection";
import { fukumenzanPlayRecordDisplay } from "@/games/fukumenzan/ui/play-record-display";
import {
  formatFukumenzanProblemFeatures,
  fukumenzanProblemFeatureAxisDisplays,
} from "@/games/fukumenzan/ui/problem-features";

export const fukumenzanCatalogEntry = {
  id: fukumenzanPlayRecordDefinition.gameId,
  name: FUKUMENZAN_DISPLAY_NAME,
  pictogramSvg,
  homePath: "/puzzles/fukumenzan",
  playPath: "/puzzles/fukumenzan/play/:problemId",
  playRecordDisplay: fukumenzanPlayRecordDisplay,
  recordProblemPlayTarget(record) {
    return isFukumenzanPlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseDifficultyLevel(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectFukumenzanProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseDifficultyLevel(start.difficulty),
      start.problemIdentity,
      canSelectFukumenzanProblemById,
    );
  },
  listPoolProblemIds: listFukumenzanPoolProblemIds,
  hasRecordResult(record) {
    return restoreFukumenzanRecordedResult(record) !== null;
  },
  renderRecordResult(record, context) {
    const recorded = restoreFukumenzanRecordedResult(record);
    return recorded ? (
      <RecordedFukumenzanResult {...recorded} {...context} />
    ) : null;
  },
  describePoolProblem(difficulty, problemId) {
    const features = findFukumenzanPoolProblemFeatures(difficulty, problemId);
    return features ? formatFukumenzanProblemFeatures(features) : null;
  },
  problemFeatureFilter: createProblemFeatureFilter(
    findFukumenzanPoolProblemFeatures,
    fukumenzanProblemFeatureAxes,
    fukumenzanProblemFeatureAxisDisplays,
  ),
} satisfies GameCatalogEntry;
