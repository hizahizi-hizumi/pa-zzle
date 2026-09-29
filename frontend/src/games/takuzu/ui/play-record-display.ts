import {
  getTakuzuDifficultyLabel,
  parseTakuzuDifficulty,
} from "@/games/takuzu/difficulty";
import { takuzuPlayRecordDefinition } from "@/games/takuzu/play-record";
import { formatElapsedTimeDelta } from "@/lib/format-performance-delta";
import { createPlayRecordDisplay } from "@/records/ui/play-record-display";

export const takuzuPlayRecordDisplay = createPlayRecordDisplay({
  definition: takuzuPlayRecordDefinition,
  gameLabel: "バイナリパズル",
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseTakuzuDifficulty(comparisonKey);
    return difficulty ? getTakuzuDifficultyLabel(difficulty) : null;
  },
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
    "time-delta-ms": {
      label: "基準時間との差",
      historyLabel: "時間差",
      formatValue: formatElapsedTimeDelta,
      referenceValue: 0,
      axis: { kind: "duration-ms" },
    },
    "correction-count": {
      label: "置き直し",
      historyLabel: "置き直し",
      formatValue(value: number) {
        return `${value}回`;
      },
      referenceValue: 0,
      axis: { kind: "integer", minimum: 0 },
    },
  },
});
