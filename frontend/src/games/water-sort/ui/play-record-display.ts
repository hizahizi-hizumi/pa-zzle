import {
  getWaterSortDifficultyLabel,
  parseWaterSortDifficulty,
} from "@/games/water-sort/difficulty";
import {
  getWaterSortPlayRecordCompletionMoveCount,
  getWaterSortPlayRecordMoveDelta,
  getWaterSortPlayRecordScore,
  isWaterSortPlayRecord,
  waterSortPlayRecordDefinition,
} from "@/games/water-sort/play-record";
import type { PlayRecord } from "@/records/play-record";

import { formatWaterSortElapsedTime } from "./format-elapsed-time";

function formatMoveDelta(moveDelta: number): string {
  return moveDelta === 0 ? "±0" : `+${moveDelta}`;
}

export const waterSortPlayRecordDisplay = {
  definition: waterSortPlayRecordDefinition,
  gameLabel: "ウォーターソート",
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseWaterSortDifficulty(comparisonKey);
    return difficulty ? getWaterSortDifficultyLabel(difficulty) : null;
  },
  getSummary(record: PlayRecord) {
    if (!isWaterSortPlayRecord(record)) {
      return null;
    }

    const score = getWaterSortPlayRecordScore(record);
    const completionMoveCount =
      getWaterSortPlayRecordCompletionMoveCount(record);
    const moveDelta = getWaterSortPlayRecordMoveDelta(record);

    return {
      primaryMetric: {
        label: "スコア",
        value: score === null ? "再計算不可" : `${score}点`,
      },
      detailMetrics:
        completionMoveCount === null || moveDelta === null
          ? [
              {
                label: "時間",
                value: formatWaterSortElapsedTime(
                  record.payload.performance.elapsedMs,
                ),
              },
              {
                label: "総手数",
                value: String(record.payload.performance.moveCount),
              },
              {
                label: "最短",
                value: String(record.payload.performance.optimalMoveCount),
              },
            ]
          : [
              {
                label: "時間",
                value: formatWaterSortElapsedTime(
                  record.payload.performance.elapsedMs,
                ),
              },
              {
                label: "クリア手数",
                value: String(completionMoveCount),
              },
              {
                label: "最短との差",
                value: formatMoveDelta(moveDelta),
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
      formatValue: formatWaterSortElapsedTime,
    },
    {
      id: "move-delta",
      label: "最短との差",
      formatValue: formatMoveDelta,
    },
  ],
};
