import { getDifficultyLabel, parseDifficultyLevel } from "@/games/difficulty";
import { takuzuPlayRecordDefinition } from "@/games/takuzu/play-record";
import {
  createCountMetricPresentation,
  createCountProgressDisplay,
  createPlayRecordDisplay,
  elapsedTimeProgressDisplay,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/records/ui/play-record-display";

export const takuzuPlayRecordDisplay = createPlayRecordDisplay({
  definition: takuzuPlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseDifficultyLevel(comparisonKey);
    return difficulty ? getDifficultyLabel(difficulty) : null;
  },
  metrics: {
    "play-score": playScoreMetricPresentation,
    "time-delta-ms": timeDeltaMetricPresentation,
    "correction-count": createCountMetricPresentation("置き直し", "回"),
  },
  progress: {
    elapsedMs: elapsedTimeProgressDisplay,
    correctionCount: createCountProgressDisplay("置き直し", "回"),
  },
});
