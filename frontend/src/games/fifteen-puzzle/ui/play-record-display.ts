import {
  getFifteenPuzzleDifficultyLabel,
  parseFifteenPuzzleDifficulty,
} from "@/games/fifteen-puzzle/difficulty";
import { fifteenPuzzlePlayRecordDefinition } from "@/games/fifteen-puzzle/play-record";
import {
  formatFifteenPuzzleMoveDelta,
  formatFifteenPuzzleTimeDelta,
} from "@/games/fifteen-puzzle/ui/format-performance-delta";

export const fifteenPuzzlePlayRecordDisplay = {
  definition: fifteenPuzzlePlayRecordDefinition,
  gameLabel: "15パズル",
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseFifteenPuzzleDifficulty(comparisonKey);
    return difficulty ? getFifteenPuzzleDifficultyLabel(difficulty) : null;
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
      formatValue: formatFifteenPuzzleTimeDelta,
      referenceValue: 0,
      axis: { kind: "duration-ms" as const },
    },
    {
      id: "move-delta",
      label: "最短手数との差",
      historyLabel: "手数差",
      formatValue: formatFifteenPuzzleMoveDelta,
      referenceValue: 0,
      axis: { kind: "integer" as const, minimum: 0 },
    },
  ],
};
