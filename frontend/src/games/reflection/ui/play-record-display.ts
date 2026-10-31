import { getDifficultyLabel, parseDifficultyLevel } from "@/games/difficulty";
import { reflectionPlayRecordDefinition } from "@/games/reflection/play-record";
import {
  createPlayRecordDisplay,
  elapsedTimeProgressDisplay,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/records/ui/play-record-display";

export const reflectionPlayRecordDisplay = createPlayRecordDisplay({
  definition: reflectionPlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseDifficultyLevel(comparisonKey);
    return difficulty ? getDifficultyLabel(difficulty) : null;
  },
  metrics: {
    "play-score": playScoreMetricPresentation,
    "time-delta-ms": timeDeltaMetricPresentation,
  },
  progress: {
    elapsedMs: elapsedTimeProgressDisplay,
  },
});
