import {
  createCountMetricPresentation,
  createPlayRecordDisplay,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/features/records/ui/play-record-display";
import { getDifficultyLabel, parseDifficultyLevel } from "@/games/difficulty";
import { takuzuPlayRecordDefinition } from "@/games/takuzu/play-record";

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
});
