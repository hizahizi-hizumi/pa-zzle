import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedParkingJamResult } from "@/game-catalog/parking-jam/RecordedParkingJamResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/parking-jam/assets/pictogram.svg?raw";
import pictogramShowcaseSvg from "@/games/parking-jam/assets/pictogram-showcase.svg?raw";
import { PARKING_JAM_DISPLAY_NAME } from "@/games/parking-jam/display-name";
import {
  isParkingJamPlayRecord,
  parkingJamPlayRecordDefinition,
  restoreParkingJamRecordedResult,
} from "@/games/parking-jam/play-record";
import {
  findParkingJamPoolProblemFeatures,
  listParkingJamPoolProblemIds,
  parkingJamProblemFeatureAxes,
} from "@/games/parking-jam/problem/problem-pool";
import { canSelectParkingJamProblemById } from "@/games/parking-jam/problem-selection";
import { parkingJamPlayRecordDisplay } from "@/games/parking-jam/ui/play-record-display";
import {
  formatParkingJamProblemFeatures,
  parkingJamProblemFeatureAxisDisplays,
} from "@/games/parking-jam/ui/problem-features";

export const parkingJamCatalogEntry = {
  id: parkingJamPlayRecordDefinition.gameId,
  name: PARKING_JAM_DISPLAY_NAME,
  pictogramSvg,
  pictogramShowcaseSvg,
  homePath: "/puzzles/parking-jam",
  playPath: "/puzzles/parking-jam/play/:difficulty",
  playRecordDisplay: parkingJamPlayRecordDisplay,
  // 難易度の定義に遊ぶ人が一目で分かる数が無いので、問題集の中身を短く言い表す。
  levelSummaries: {
    "1": "すぐ出せる",
    "2": "見落とし",
    "3": "2段の待ち",
    "4": "読み違い多",
    "5": "3段以上",
  },
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
  hasRecordResult(record) {
    return restoreParkingJamRecordedResult(record) !== null;
  },
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
  problemFeatureFilter: createProblemFeatureFilter(
    findParkingJamPoolProblemFeatures,
    parkingJamProblemFeatureAxes,
    parkingJamProblemFeatureAxisDisplays,
  ),
} satisfies GameCatalogEntry;
