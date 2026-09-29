import {
  getWaterSortDifficultyLabel,
  parseWaterSortRecordedDifficulty,
} from "@/games/water-sort/difficulty";
import { waterSortPlayRecordDefinition } from "@/games/water-sort/play-record";
import {
  formatCountDelta,
  formatElapsedTimeDelta,
} from "@/lib/format-performance-delta";
import { createPlayRecordDisplay } from "@/records/ui/play-record-display";

export const waterSortPlayRecordDisplay = createPlayRecordDisplay({
  definition: waterSortPlayRecordDefinition,
  gameLabel: "ウォーターソート",
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseWaterSortRecordedDifficulty(comparisonKey);
    return difficulty ? getWaterSortDifficultyLabel(difficulty) : null;
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
    "move-delta": {
      label: "最短手数との差",
      historyLabel: "手数差",
      formatValue: formatCountDelta,
      referenceValue: 0,
      axis: { kind: "integer", minimum: 0 },
    },
  },
});
