import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedIceFloorMazeResult } from "@/game-catalog/ice-floor-maze/RecordedIceFloorMazeResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/ice-floor-maze/assets/pictogram.svg?raw";
import { ICE_FLOOR_MAZE_DISPLAY_NAME } from "@/games/ice-floor-maze/display-name";
import {
  iceFloorMazePlayRecordDefinition,
  isIceFloorMazePlayRecord,
  restoreIceFloorMazeRecordedResult,
} from "@/games/ice-floor-maze/play-record";
import { listIceFloorMazePoolProblemIds } from "@/games/ice-floor-maze/problem/problem-pool";
import {
  findIceFloorMazePoolProblemFeatures,
  iceFloorMazeProblemFeatureAxes,
} from "@/games/ice-floor-maze/problem-features";
import { canSelectIceFloorMazeProblemById } from "@/games/ice-floor-maze/problem-selection";
import { iceFloorMazePlayRecordDisplay } from "@/games/ice-floor-maze/ui/play-record-display";
import {
  formatIceFloorMazeProblemFeatures,
  iceFloorMazeProblemFeatureAxisDisplays,
} from "@/games/ice-floor-maze/ui/problem-features";

export const iceFloorMazeCatalogEntry = {
  id: iceFloorMazePlayRecordDefinition.gameId,
  name: ICE_FLOOR_MAZE_DISPLAY_NAME,
  pictogramSvg,
  entryPath: "/puzzles/ice-floor-maze",
  playPath: "/puzzles/ice-floor-maze/play/:difficulty",
  playRecordDisplay: iceFloorMazePlayRecordDisplay,
  recordProblemPlayTarget(record) {
    return isIceFloorMazePlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseDifficultyLevel(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectIceFloorMazeProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseDifficultyLevel(start.difficulty),
      start.problemIdentity,
      canSelectIceFloorMazeProblemById,
    );
  },
  listPoolProblemIds: listIceFloorMazePoolProblemIds,
  renderRecordResult(record, context) {
    const recorded = restoreIceFloorMazeRecordedResult(record);
    return recorded ? (
      <RecordedIceFloorMazeResult {...recorded} {...context} />
    ) : null;
  },
  describePoolProblem(difficulty, problemId) {
    const features = findIceFloorMazePoolProblemFeatures(difficulty, problemId);
    return features ? formatIceFloorMazeProblemFeatures(features) : null;
  },
  problemFeatureFilter: createProblemFeatureFilter(
    findIceFloorMazePoolProblemFeatures,
    iceFloorMazeProblemFeatureAxes,
    iceFloorMazeProblemFeatureAxisDisplays,
  ),
} satisfies GameCatalogEntry;
