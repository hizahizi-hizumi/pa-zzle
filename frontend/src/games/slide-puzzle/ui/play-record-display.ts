import {
  getSlidePuzzleDifficultyLabel,
  parseSlidePuzzleDifficulty,
} from "@/games/slide-puzzle/difficulty";
import { slidePuzzlePlayRecordDefinition } from "@/games/slide-puzzle/play-record";
import {
  formatSlidePuzzleMoveDelta,
  formatSlidePuzzleTimeDelta,
} from "@/games/slide-puzzle/ui/format-performance-delta";

export const slidePuzzlePlayRecordDisplay = {
  definition: slidePuzzlePlayRecordDefinition,
  gameLabel: "スライドパズル",
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseSlidePuzzleDifficulty(comparisonKey);
    return difficulty ? getSlidePuzzleDifficultyLabel(difficulty) : null;
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
      formatValue: formatSlidePuzzleTimeDelta,
      referenceValue: 0,
      axis: { kind: "duration-ms" as const },
    },
    {
      id: "move-delta",
      label: "最短手数との差",
      historyLabel: "手数差",
      formatValue: formatSlidePuzzleMoveDelta,
      referenceValue: 0,
      axis: { kind: "integer" as const, minimum: 0 },
    },
  ],
};
