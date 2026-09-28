import {
  getWaterSortDifficultyLabel,
  parseWaterSortRecordedDifficulty,
} from "@/games/water-sort/difficulty";
import { waterSortPlayRecordDefinition } from "@/games/water-sort/play-record";

import {
  formatCountDelta,
  formatElapsedTimeDelta,
} from "@/lib/format-performance-delta";

export const waterSortPlayRecordDisplay = {
  definition: waterSortPlayRecordDefinition,
  gameLabel: "ウォーターソート",
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseWaterSortRecordedDifficulty(comparisonKey);
    return difficulty ? getWaterSortDifficultyLabel(difficulty) : null;
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
      formatValue: formatElapsedTimeDelta,
      referenceValue: 0,
      axis: { kind: "duration-ms" as const },
    },
    {
      id: "move-delta",
      label: "最短手数との差",
      historyLabel: "手数差",
      formatValue: formatCountDelta,
      referenceValue: 0,
      axis: { kind: "integer" as const, minimum: 0 },
    },
  ],
};
