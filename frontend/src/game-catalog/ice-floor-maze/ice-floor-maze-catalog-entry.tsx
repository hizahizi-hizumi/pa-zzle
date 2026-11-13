import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedIceFloorMazeResult } from "@/game-catalog/ice-floor-maze/RecordedIceFloorMazeResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/ice-floor-maze/assets/pictogram.svg?raw";
import pictogramShowcaseSvg from "@/games/ice-floor-maze/assets/pictogram-showcase.svg?raw";
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
  pictogramShowcaseSvg,
  homePath: "/puzzles/ice-floor-maze",
  playPath: "/puzzles/ice-floor-maze/play/:difficulty",
  playRecordDisplay: iceFloorMazePlayRecordDisplay,
  // 難易度の定義に遊ぶ人が一目で分かる数が無いので、問題集の中身を短く言い表す。
  levelSummaries: {
    "1": "7〜10手",
    "2": "10〜16手",
    "3": "地形2〜3",
    "4": "地形3〜6",
    "5": "地形4〜8",
  },
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
  hasRecordResult(record) {
    return restoreIceFloorMazeRecordedResult(record) !== null;
  },
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
