import {
  getNanpureDifficultyLabel,
  parseNanpureDifficulty,
} from "@/games/nanpure/difficulty";
import { nanpurePlayRecordDefinition } from "@/games/nanpure/play-record";

import { formatElapsedTime } from "./format-elapsed-time";

export const nanpurePlayRecordDisplay = {
  definition: nanpurePlayRecordDefinition,
  gameLabel: "ナンプレ",
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseNanpureDifficulty(comparisonKey);
    return difficulty ? getNanpureDifficultyLabel(difficulty) : null;
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
      id: "elapsed-ms",
      label: "クリア時間",
      historyLabel: "時間",
      formatValue: formatElapsedTime,
      axis: { kind: "duration-ms" as const, minimum: 0 },
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
