import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/app/game-integration/game-catalog-entry";
import { RecordedShuttleParkingResult } from "@/app/game-integration/shuttle-parking/RecordedShuttleParkingResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/shuttle-parking/assets/pictogram.svg?raw";
import pictogramShowcaseSvg from "@/games/shuttle-parking/assets/pictogram-showcase.svg?raw";
import { SHUTTLE_PARKING_DISPLAY_NAME } from "@/games/shuttle-parking/display-name";
import {
  isShuttleParkingPlayRecord,
  restoreShuttleParkingRecordedResult,
  shuttleParkingPlayRecordDefinition,
} from "@/games/shuttle-parking/play-record";
import {
  findShuttleParkingPoolProblemFeatures,
  listShuttleParkingPoolProblemIds,
  shuttleParkingProblemFeatureAxes,
} from "@/games/shuttle-parking/problem/problem-pool";
import { canSelectShuttleParkingProblemById } from "@/games/shuttle-parking/problem-selection";
import { shuttleParkingPlayRecordDisplay } from "@/games/shuttle-parking/ui/play-record-display";
import {
  formatShuttleParkingProblemFeatures,
  shuttleParkingProblemFeatureAxisDisplays,
} from "@/games/shuttle-parking/ui/problem-features";

export const shuttleParkingCatalogEntry = {
  id: shuttleParkingPlayRecordDefinition.gameId,
  name: SHUTTLE_PARKING_DISPLAY_NAME,
  pictogramSvg,
  pictogramShowcaseSvg,
  homePath: "/puzzles/shuttle-parking",
  playPath: "/puzzles/shuttle-parking/play/:problemId",
  playRecordDisplay: shuttleParkingPlayRecordDisplay,
  recordProblemPlayTarget(record) {
    return isShuttleParkingPlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseDifficultyLevel(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectShuttleParkingProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseDifficultyLevel(start.difficulty),
      start.problemIdentity,
      canSelectShuttleParkingProblemById,
    );
  },
  listPoolProblemIds: listShuttleParkingPoolProblemIds,
  hasRecordResult(record) {
    return restoreShuttleParkingRecordedResult(record) !== null;
  },
  renderRecordResult(record, context) {
    const recorded = restoreShuttleParkingRecordedResult(record);
    return recorded ? (
      <RecordedShuttleParkingResult {...recorded} {...context} />
    ) : null;
  },
  describePoolProblem(difficulty, problemId) {
    const features = findShuttleParkingPoolProblemFeatures(
      difficulty,
      problemId,
    );
    return features ? formatShuttleParkingProblemFeatures(features) : null;
  },
  problemFeatureFilter: createProblemFeatureFilter(
    findShuttleParkingPoolProblemFeatures,
    shuttleParkingProblemFeatureAxes,
    shuttleParkingProblemFeatureAxisDisplays,
  ),
} satisfies GameCatalogEntry;
