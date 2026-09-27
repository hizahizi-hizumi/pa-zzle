import {
  getParkingJamDifficultyLabel,
  parseParkingJamRecordedDifficulty,
} from "@/games/parking-jam/difficulty";
import { parkingJamPlayRecordDefinition } from "@/games/parking-jam/play-record";
import { formatParkingJamElapsedTime } from "@/games/parking-jam/ui/format-elapsed-time";

export const parkingJamPlayRecordDisplay = {
  definition: parkingJamPlayRecordDefinition,
  gameLabel: "パーキングジャム",
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseParkingJamRecordedDifficulty(comparisonKey);
    return difficulty ? getParkingJamDifficultyLabel(difficulty) : null;
  },
  metrics: [
    {
      id: "play-score",
      label: "スコア",
      historyLabel: "スコア",
      formatValue(value: number) {
        return `${value}点`;
      },
      referenceValue: 100,
      axis: { kind: "integer" as const, minimum: 0, maximum: 100 },
    },
    {
      id: "elapsed-ms",
      label: "クリア時間",
      historyLabel: "時間",
      formatValue: formatParkingJamElapsedTime,
      axis: { kind: "duration-ms" as const, minimum: 0 },
    },
    {
      id: "failed-move-count",
      label: "ミス",
      historyLabel: "ミス",
      formatValue(value: number) {
        return `${value}回`;
      },
      referenceValue: 0,
      axis: { kind: "integer" as const, minimum: 0 },
    },
  ],
};
