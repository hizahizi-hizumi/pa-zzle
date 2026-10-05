import {
  getDifficultyLabel,
  parseRecordedDifficulty,
} from "@/games/difficulty";
import { nanpurePlayRecordDefinition } from "@/games/nanpure/play-record";
import {
  formatDurationInWords,
  formatElapsedTime,
} from "@/lib/format-elapsed-time";
import {
  createCountMetricPresentation,
  createCountProgressDisplay,
  createPlayRecordDisplay,
  elapsedTimeProgressDisplay,
  playScoreMetricPresentation,
} from "@/records/ui/play-record-display";

export const nanpurePlayRecordDisplay = createPlayRecordDisplay({
  definition: nanpurePlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseRecordedDifficulty(comparisonKey);
    return difficulty ? getDifficultyLabel(difficulty) : null;
  },
  metrics: {
    "play-score": playScoreMetricPresentation,
    "elapsed-ms": {
      label: "クリア時間",
      historyLabel: "時間",
      formatValue: formatElapsedTime,
      formatImprovement(amount: number) {
        const wholeSecondsMs = Math.floor(amount / 1_000) * 1_000;
        return `${formatDurationInWords(wholeSecondsMs)}短縮`;
      },
      axis: { kind: "duration-ms", minimum: 0 },
    },
    "mistake-count": createCountMetricPresentation("ミス", "回"),
  },
  progress: {
    elapsedMs: elapsedTimeProgressDisplay,
    mistakeCount: createCountProgressDisplay("ミス", "回"),
  },
});
