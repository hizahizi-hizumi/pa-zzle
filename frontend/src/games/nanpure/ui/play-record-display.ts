import {
  getNanpureDifficultyLabel,
  parseNanpureDifficulty,
} from "@/games/nanpure/difficulty";
import {
  getNanpurePlayRecordScore,
  isNanpurePlayRecord,
  nanpurePlayRecordDefinition,
} from "@/games/nanpure/play-record";
import { formatRecordElapsedMs } from "@/records/ui/format";
import type { PlayRecordDisplayDefinition } from "@/records/ui/play-record-display";

export const nanpurePlayRecordDisplay: PlayRecordDisplayDefinition = {
  definition: nanpurePlayRecordDefinition,
  gameLabel: "ナンプレ",
  getComparisonLabel(comparisonKey) {
    const difficulty = parseNanpureDifficulty(comparisonKey);
    return difficulty ? getNanpureDifficultyLabel(difficulty) : null;
  },
  getSummary(record) {
    if (!isNanpurePlayRecord(record)) {
      return null;
    }

    return {
      primaryMetric: {
        label: "スコア",
        value: `${getNanpurePlayRecordScore(record)}点`,
      },
      detailMetrics: [
        {
          label: "時間",
          value: formatRecordElapsedMs(record.payload.performance.elapsedMs),
        },
        {
          label: "ミス",
          value: String(record.payload.performance.mistakeCount),
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
      id: "mistake-count",
      label: "最少ミス",
      formatValue(value) {
        return `${value}回`;
      },
    },
  ],
};
