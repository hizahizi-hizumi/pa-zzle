import {
  getMinesweeperDifficultyLabel,
  parseMinesweeperDifficulty,
} from "@/games/minesweeper/difficulty";
import { minesweeperPlayRecordDefinition } from "@/games/minesweeper/play-record";
import { formatElapsedTimeDelta } from "@/lib/format-performance-delta";
import { createPlayRecordDisplay } from "@/records/ui/play-record-display";

export const minesweeperPlayRecordDisplay = createPlayRecordDisplay({
  definition: minesweeperPlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseMinesweeperDifficulty(comparisonKey);
    return difficulty ? getMinesweeperDifficultyLabel(difficulty) : null;
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
});
