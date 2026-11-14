import {
  createPlayRecordDisplay,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/features/records/ui/play-record-display";
import { bridgesPlayRecordDefinition } from "@/games/bridges/play-record";
import { getDifficultyLabel, parseDifficultyLevel } from "@/games/difficulty";

export const bridgesPlayRecordDisplay = createPlayRecordDisplay({
  definition: bridgesPlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseDifficultyLevel(comparisonKey);
    return difficulty ? getDifficultyLabel(difficulty) : null;
  },
  metrics: {
    "play-score": playScoreMetricPresentation,
    "time-delta-ms": timeDeltaMetricPresentation,
  },
});
