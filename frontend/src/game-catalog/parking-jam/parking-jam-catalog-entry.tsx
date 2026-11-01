import {
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedParkingJamResult } from "@/game-catalog/parking-jam/RecordedParkingJamResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/parking-jam/assets/pictogram.svg?raw";
import { PARKING_JAM_DISPLAY_NAME } from "@/games/parking-jam/display-name";
import {
  isParkingJamPlayRecord,
  parkingJamPlayRecordDefinition,
  restoreParkingJamRecordedResult,
} from "@/games/parking-jam/play-record";
import {
  findParkingJamPoolProblemFeatures,
  listParkingJamPoolProblemIds,
} from "@/games/parking-jam/problem/problem-pool";
import { canSelectParkingJamProblemById } from "@/games/parking-jam/problem-selection";
import { parkingJamPlayRecordDisplay } from "@/games/parking-jam/ui/play-record-display";
import { formatParkingJamProblemFeatures } from "@/games/parking-jam/ui/problem-features";

export const parkingJamCatalogEntry = {
  id: parkingJamPlayRecordDefinition.gameId,
  name: PARKING_JAM_DISPLAY_NAME,
  pictogramSvg,
  entryPath: "/puzzles/parking-jam",
  playPath: "/puzzles/parking-jam/play/:difficulty",
  playRecordDisplay: parkingJamPlayRecordDisplay,
  recordProblemPlayTarget(record) {
    return isParkingJamPlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseDifficultyLevel(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectParkingJamProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseDifficultyLevel(start.difficulty),
      start.problemIdentity,
      canSelectParkingJamProblemById,
    );
  },
  listPoolProblemIds: listParkingJamPoolProblemIds,
  renderRecordResult(record, context) {
    const recorded = restoreParkingJamRecordedResult(record);
    return recorded ? (
      <RecordedParkingJamResult {...recorded} {...context} />
    ) : null;
  },
  describePoolProblem(difficulty, problemId) {
    const features = findParkingJamPoolProblemFeatures(difficulty, problemId);
    return features ? formatParkingJamProblemFeatures(features) : null;
  },
} satisfies GameCatalogEntry;
