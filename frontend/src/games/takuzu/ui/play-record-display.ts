import {
  getTakuzuDifficultyLabel,
  parseTakuzuDifficulty,
} from "@/games/takuzu/difficulty";
import { takuzuPlayRecordDefinition } from "@/games/takuzu/play-record";
import { formatTakuzuTimeDelta } from "@/games/takuzu/ui/format-performance-delta";

export const takuzuPlayRecordDisplay = {
  definition: takuzuPlayRecordDefinition,
  gameLabel: "バイナリパズル",
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseTakuzuDifficulty(comparisonKey);
    return difficulty ? getTakuzuDifficultyLabel(difficulty) : null;
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
      id: "time-delta-ms",
      label: "基準時間との差",
      historyLabel: "時間差",
      formatValue: formatTakuzuTimeDelta,
      referenceValue: 0,
      axis: { kind: "duration-ms" as const },
    },
    {
      id: "correction-count",
      label: "置き直し",
      historyLabel: "置き直し",
      formatValue(value: number) {
        return `${value}回`;
      },
      referenceValue: 0,
      axis: { kind: "integer" as const, minimum: 0 },
    },
  ],
};
