import {
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedParkingJamResult } from "@/game-catalog/parking-jam/RecordedParkingJamResult";
import pictogramSvg from "@/games/parking-jam/assets/pictogram.svg?raw";
import { parseParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import {
  isParkingJamPlayRecord,
  parkingJamPlayRecordDefinition,
  restoreParkingJamRecordedResult,
} from "@/games/parking-jam/play-record";
import { canSelectParkingJamProblemById } from "@/games/parking-jam/problem-selection";
import { parkingJamPlayRecordDisplay } from "@/games/parking-jam/ui/play-record-display";

export const parkingJamCatalogEntry = {
  id: parkingJamPlayRecordDefinition.gameId,
  name: "パーキングジャム",
  pictogramSvg,
  entryPath: "/puzzles/parking-jam",
  playPath: "/puzzles/parking-jam/play/:difficulty",
  playRecordDisplay: parkingJamPlayRecordDisplay,
  recordProblemPlayTarget(record) {
    return isParkingJamPlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseParkingJamDifficulty(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectParkingJamProblemById,
        )
      : null;
  },
  renderRecordResult(record, context) {
    const recorded = restoreParkingJamRecordedResult(record);
    return recorded ? (
      <RecordedParkingJamResult {...recorded} {...context} />
    ) : null;
  },
} satisfies GameCatalogEntry;
