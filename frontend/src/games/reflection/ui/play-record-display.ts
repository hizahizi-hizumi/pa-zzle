import {
  getReflectionDifficultyLabel,
  parseReflectionDifficulty,
} from "@/games/reflection/difficulty";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import { reflectionPlayRecordDefinition } from "@/games/reflection/play-record";
import { formatReflectionTimeDelta } from "@/games/reflection/ui/format-performance-delta";

export const reflectionPlayRecordDisplay = {
  definition: reflectionPlayRecordDefinition,
  gameLabel: REFLECTION_DISPLAY_NAME,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseReflectionDifficulty(comparisonKey);
    return difficulty ? getReflectionDifficultyLabel(difficulty) : null;
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
      formatValue: formatReflectionTimeDelta,
      referenceValue: 0,
      axis: { kind: "duration-ms" as const },
    },
  ],
};
