import {
  createCountMetricPresentation,
  createPlayRecordDisplay,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/features/records/ui/play-record-display";
import {
  getDifficultyLabel,
  parseRecordedDifficulty,
} from "@/games/difficulty";
import { parkingJamPlayRecordDefinition } from "@/games/parking-jam/play-record";

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
});
