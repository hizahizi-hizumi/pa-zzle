import { getWaterSortDifficultyLabel } from "@/games/water-sort/game/difficulty";
import {
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
  getComparisonLabel(record) {
    return isWaterSortPlayRecord(record)
      ? getWaterSortDifficultyLabel(record.payload.difficulty)
      : null;
  },
  getSummary(record) {
    if (!isWaterSortPlayRecord(record)) {
      return null;
    }

    return {
      primaryMetric: {
        label: "プレイ評価",
        value: `${getWaterSortPlayRecordScore(record)}点`,
      },
      detailMetrics: [
        {
          label: "時間",
          value: formatRecordElapsedMs(record.payload.performance.elapsedMs),
        },
        {
          label: "手数",
          value: String(record.payload.performance.moveCount),
        },
        {
          label: "最短との差",
          value: formatMoveDelta(getWaterSortPlayRecordMoveDelta(record)),
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
