import { getNanpureDifficultyLabel } from "@/games/nanpure/game/difficulty";
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
  getComparisonLabel(record) {
    return isNanpurePlayRecord(record)
      ? getNanpureDifficultyLabel(record.payload.difficulty)
      : null;
  },
  getSummary(record) {
    if (!isNanpurePlayRecord(record)) {
      return null;
    }

    return {
      primaryMetric: {
        label: "プレイ評価",
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
      id: "mistake-count",
      label: "最少ミス",
      formatValue(value) {
        return `${value}回`;
      },
    },
  ],
};
