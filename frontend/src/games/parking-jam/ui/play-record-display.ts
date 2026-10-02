import {
  getParkingJamDifficultyLabel,
  parseParkingJamRecordedDifficulty,
} from "@/games/parking-jam/difficulty";
import {
  isParkingJamPlayRecord,
  parkingJamPlayRecordDefinition,
} from "@/games/parking-jam/play-record";
import { formatElapsedTime } from "@/lib/format-elapsed-time";
import type { PlayRecord } from "@/records/play-record";
import { createPlayRecordDisplay } from "@/records/ui/play-record-display";

const PARKING_JAM_HISTORY_COPY_FORMAT_VERSION = 1;

function serializeParkingJamHistoryRecord(record: PlayRecord): string | null {
  if (!isParkingJamPlayRecord(record)) return null;

  const { payload } = record;
  return JSON.stringify(
    {
      formatVersion: PARKING_JAM_HISTORY_COPY_FORMAT_VERSION,
      game: "parking-jam",
      recordId: record.id,
      completedAt: record.completedAt,
      payloadVersion: record.payloadVersion,
      difficulty: payload.difficulty,
      difficultyModelVersion:
        "difficultyModelVersion" in payload
          ? payload.difficultyModelVersion
          : null,
      scoreModelVersion:
        "scoreModelVersion" in payload ? payload.scoreModelVersion : null,
      problemIdentity: payload.problemIdentity,
      problemFacts: "problemFacts" in payload ? payload.problemFacts : null,
      performance: payload.performance,
    },
    null,
    2,
  );
}

export const parkingJamPlayRecordDisplay = createPlayRecordDisplay({
  definition: parkingJamPlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseParkingJamRecordedDifficulty(comparisonKey);
    return difficulty ? getParkingJamDifficultyLabel(difficulty) : null;
  },
  getHistoryCopyText: serializeParkingJamHistoryRecord,
  metrics: {
    "play-score": {
      label: "スコア",
      historyLabel: "スコア",
      formatValue(value: number) {
        return `${value}点`;
      },
      referenceValue: 100,
      axis: { kind: "integer", minimum: 0, maximum: 100 },
    },
    "elapsed-ms": {
      label: "クリア時間",
      historyLabel: "時間",
      formatValue: formatElapsedTime,
      axis: { kind: "duration-ms", minimum: 0 },
    },
    "failed-move-count": {
      label: "ミス",
      historyLabel: "ミス",
      formatValue(value: number) {
        return `${value}回`;
      },
      referenceValue: 0,
      axis: { kind: "integer", minimum: 0 },
    },
  },
});
