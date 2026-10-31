import {
  getDifficultyLabel,
  parseRecordedDifficulty,
} from "@/games/difficulty";
import { parkingJamPlayRecordDefinition } from "@/games/parking-jam/play-record";
import {
  createCountMetricPresentation,
  createCountProgressDisplay,
  createPlayRecordDisplay,
  elapsedTimeProgressDisplay,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/records/ui/play-record-display";

export const parkingJamPlayRecordDisplay = createPlayRecordDisplay({
  definition: parkingJamPlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseRecordedDifficulty(comparisonKey);
    return difficulty ? getDifficultyLabel(difficulty) : null;
  },
  metrics: {
    "play-score": playScoreMetricPresentation,
    "time-delta-ms": timeDeltaMetricPresentation,
    "failed-move-count": createCountMetricPresentation("ミス", "回"),
  },
  progress: {
    elapsedMs: elapsedTimeProgressDisplay,
    failedMoveCount: createCountProgressDisplay("ミス", "回"),
  },
});
