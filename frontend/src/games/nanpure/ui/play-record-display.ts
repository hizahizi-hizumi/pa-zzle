import {
  getNanpureDifficultyLabel,
  parseNanpureRecordedDifficulty,
} from "@/games/nanpure/difficulty";
import { nanpurePlayRecordDefinition } from "@/games/nanpure/play-record";

import { formatElapsedTime } from "@/lib/format-elapsed-time";
import { createPlayRecordDisplay } from "@/records/ui/play-record-display";

export const nanpurePlayRecordDisplay = createPlayRecordDisplay({
  definition: nanpurePlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseNanpureRecordedDifficulty(comparisonKey);
    return difficulty ? getNanpureDifficultyLabel(difficulty) : null;
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
    "elapsed-ms": {
      label: "クリア時間",
      historyLabel: "時間",
      formatValue: formatElapsedTime,
      axis: { kind: "duration-ms", minimum: 0 },
    },
    "mistake-count": {
      label: "ミス",
      historyLabel: "ミス",
      formatValue(value: number) {
        return `${value}回`;
      },
      referenceValue: 0,
      axis: { kind: "integer", minimum: 0 },
    },
  },
  progress: {
    elapsedMs: { label: "経過", formatValue: formatElapsedTime },
    mistakeCount: {
      label: "ミス",
      formatValue(value: number) {
        return `${value}回`;
      },
    },
  },
});
