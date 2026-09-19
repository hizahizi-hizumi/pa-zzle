import {
  getNanpureDifficultyLabel,
  parseNanpureDifficulty,
} from "@/games/nanpure/difficulty";
import {
  getNanpurePlayRecordScore,
  isNanpurePlayRecord,
  nanpurePlayRecordDefinition,
} from "@/games/nanpure/play-record";
import type { PlayRecord } from "@/records/play-record";

import { formatElapsedTime } from "./format-elapsed-time";

export const nanpurePlayRecordDisplay = {
  definition: nanpurePlayRecordDefinition,
  gameLabel: "ナンプレ",
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseNanpureDifficulty(comparisonKey);
    return difficulty ? getNanpureDifficultyLabel(difficulty) : null;
  },
  getSummary(record: PlayRecord) {
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
          value: formatElapsedTime(record.payload.performance.elapsedMs),
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
      formatValue(value: number) {
        return `${value}点`;
      },
    },
    {
      id: "elapsed-ms",
      label: "最速",
      formatValue: formatElapsedTime,
    },
    {
      id: "mistake-count",
      label: "最少ミス",
      formatValue(value: number) {
        return `${value}回`;
      },
    },
  ],
};
