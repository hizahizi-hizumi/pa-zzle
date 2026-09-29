import {
  getReflectionDifficultyLabel,
  parseReflectionDifficulty,
} from "@/games/reflection/difficulty";
import { reflectionPlayRecordDefinition } from "@/games/reflection/play-record";
import { formatElapsedTimeDelta } from "@/lib/format-performance-delta";
import { createPlayRecordDisplay } from "@/records/ui/play-record-display";

export const reflectionPlayRecordDisplay = createPlayRecordDisplay({
  definition: reflectionPlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseReflectionDifficulty(comparisonKey);
    return difficulty ? getReflectionDifficultyLabel(difficulty) : null;
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
  },
});
