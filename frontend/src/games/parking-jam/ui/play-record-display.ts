import {
  getParkingJamDifficultyLabel,
  parseParkingJamDifficulty,
} from "@/games/parking-jam/difficulty";
import {
  getParkingJamPlayRecordScore,
  isParkingJamPlayRecord,
  parkingJamPlayRecordDefinition,
} from "@/games/parking-jam/play-record";
import { formatParkingJamElapsedTime } from "@/games/parking-jam/ui/format-elapsed-time";
import type { PlayRecord } from "@/records/play-record";

export const parkingJamPlayRecordDisplay = {
  definition: parkingJamPlayRecordDefinition,
  gameLabel: "パーキングジャム",
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseParkingJamDifficulty(comparisonKey);
    return difficulty ? getParkingJamDifficultyLabel(difficulty) : null;
  },
  getSummary(record: PlayRecord) {
    if (!isParkingJamPlayRecord(record)) return null;

    return {
      primaryMetric: {
        label: "スコア",
        value: `${getParkingJamPlayRecordScore(record)}点`,
      },
      detailMetrics: [
        {
          label: "時間",
          value: formatParkingJamElapsedTime(
            record.payload.performance.elapsedMs,
          ),
        },
        {
          label: "ミス",
          value: String(record.payload.performance.failedMoveCount),
        },
        {
          label: "待った",
          value: String(record.payload.performance.undoCount),
        },
        {
          label: "やり直し",
          value: String(record.payload.performance.restartCount),
        },
      ],
    };
  },
  personalBestMetrics: [
    {
      id: "play-score",
      label: "ベストスコア",
      formatValue(value: number) {
        return `${value}点`;
      },
    },
    {
      id: "elapsed-ms",
      label: "最速",
      formatValue: formatParkingJamElapsedTime,
    },
    {
      id: "failed-move-count",
      label: "最少ミス",
      formatValue(value: number) {
        return `${value}回`;
      },
    },
  ],
};
