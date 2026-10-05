import { getDifficultyLabel, parseDifficultyLevel } from "@/games/difficulty";
import { minesweeperPlayRecordDefinition } from "@/games/minesweeper/play-record";
import {
  createCountMetricPresentation,
  createCountProgressDisplay,
  createPlayRecordDisplay,
  elapsedTimeProgressDisplay,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/records/ui/play-record-display";

export const minesweeperPlayRecordDisplay = createPlayRecordDisplay({
  definition: minesweeperPlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseDifficultyLevel(comparisonKey);
    return difficulty ? getDifficultyLabel(difficulty) : null;
  },
  metrics: {
    "play-score": playScoreMetricPresentation,
    "time-delta-ms": timeDeltaMetricPresentation,
    "mistake-count": createCountMetricPresentation("ミス", "回"),
  },
  progress: {
    elapsedMs: elapsedTimeProgressDisplay,
    mistakeCount: createCountProgressDisplay("ミス", "回"),
  },
});
