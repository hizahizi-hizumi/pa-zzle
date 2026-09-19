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
import { formatRecordElapsedMs } from "@/records/ui/format";
import type { PlayRecordDisplayDefinition } from "@/records/ui/play-record-display";

function formatMoveDelta(moveDelta: number): string {
  return moveDelta === 0 ? "±0" : `+${moveDelta}`;
}

export const waterSortPlayRecordDisplay: PlayRecordDisplayDefinition = {
  definition: waterSortPlayRecordDefinition,
  gameLabel: "ウォーターソート",
  getComparisonLabel(comparisonKey) {
    const difficulty = parseWaterSortDifficulty(comparisonKey);
    return difficulty ? getWaterSortDifficultyLabel(difficulty) : null;
  },
  getSummary(record) {
    if (!isWaterSortPlayRecord(record)) {
      return null;
    }

    const score = getWaterSortPlayRecordScore(record);
    const completionMoveCount =
      getWaterSortPlayRecordCompletionMoveCount(record);
    const moveDelta = getWaterSortPlayRecordMoveDelta(record);

    return {
      primaryMetric: {
        label: "プレイ評価",
        value: score === null ? "再計算不可" : `${score}点`,
      },
      detailMetrics:
        completionMoveCount === null || moveDelta === null
          ? [
              {
                label: "時間",
                value: formatRecordElapsedMs(
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
                value: formatRecordElapsedMs(
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
      label: "最高評価",
      formatValue(value) {
        return `${value}点`;
      },
    },
    {
      id: "elapsed-ms",
      label: "最速",
      formatValue: formatRecordElapsedMs,
    },
    {
      id: "move-delta",
      label: "最短との差",
      formatValue: formatMoveDelta,
    },
  ],
};
