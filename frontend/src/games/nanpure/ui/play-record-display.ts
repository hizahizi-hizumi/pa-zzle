import {
  getDifficultyLabel,
  parseRecordedDifficulty,
} from "@/games/difficulty";
import { nanpurePlayRecordDefinition } from "@/games/nanpure/play-record";
import {
  createCountMetricPresentation,
  createPlayRecordDisplay,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/records/ui/play-record-display";

export const nanpurePlayRecordDisplay = createPlayRecordDisplay({
  definition: nanpurePlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseRecordedDifficulty(comparisonKey);
    return difficulty ? getDifficultyLabel(difficulty) : null;
  },
  metrics: {
    "play-score": playScoreMetricPresentation,
    "time-delta-ms": timeDeltaMetricPresentation,
    "mistake-count": createCountMetricPresentation("ミス", "回"),
  },
});
