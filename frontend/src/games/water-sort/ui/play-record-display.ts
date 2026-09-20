import {
  getWaterSortDifficultyLabel,
  parseWaterSortDifficulty,
} from "@/games/water-sort/difficulty";
import { waterSortPlayRecordDefinition } from "@/games/water-sort/play-record";

import { formatWaterSortElapsedTime } from "./format-elapsed-time";

function formatMoveDelta(moveDelta: number): string {
  return moveDelta === 0 ? "±0" : `+${moveDelta}`;
}

function formatTimeDelta(timeDeltaMs: number): string {
  if (timeDeltaMs === 0) {
    return "±00:00";
  }

  const sign = timeDeltaMs > 0 ? "+" : "-";
  return `${sign}${formatWaterSortElapsedTime(Math.abs(timeDeltaMs))}`;
}

export const waterSortPlayRecordDisplay = {
  definition: waterSortPlayRecordDefinition,
  gameLabel: "ウォーターソート",
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseWaterSortDifficulty(comparisonKey);
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
      formatValue: formatTimeDelta,
      referenceValue: 0,
      axis: { kind: "duration-ms" as const },
    },
    {
      id: "move-delta",
      label: "最短手数との差",
      historyLabel: "手数差",
      formatValue: formatMoveDelta,
      referenceValue: 0,
      axis: { kind: "integer" as const, minimum: 0 },
    },
  ],
};
