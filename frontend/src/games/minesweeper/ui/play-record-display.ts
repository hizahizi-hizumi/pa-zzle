import {
  getMinesweeperDifficultyLabel,
  parseMinesweeperDifficulty,
} from "@/games/minesweeper/difficulty";
import { minesweeperPlayRecordDefinition } from "@/games/minesweeper/play-record";
import { formatMinesweeperTimeDelta } from "@/games/minesweeper/ui/format-performance-delta";

export const minesweeperPlayRecordDisplay = {
  definition: minesweeperPlayRecordDefinition,
  gameLabel: "マインスイーパー",
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseMinesweeperDifficulty(comparisonKey);
    return difficulty ? getMinesweeperDifficultyLabel(difficulty) : null;
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
      formatValue: formatMinesweeperTimeDelta,
      referenceValue: 0,
      axis: { kind: "duration-ms" as const },
    },
    {
      id: "mistake-count",
      label: "ミス",
      historyLabel: "ミス",
      formatValue(value: number) {
        return `${value}回`;
      },
      referenceValue: 0,
      axis: { kind: "integer" as const, minimum: 0 },
    },
  ],
};
