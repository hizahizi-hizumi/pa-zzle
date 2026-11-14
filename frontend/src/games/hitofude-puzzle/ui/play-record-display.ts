import {
  createCountMetricPresentation,
  createPlayRecordDisplay,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/features/records/ui/play-record-display";
import { getDifficultyLabel, parseDifficultyLevel } from "@/games/difficulty";
import { hitofudePuzzlePlayRecordDefinition } from "@/games/hitofude-puzzle/play-record";

export const hitofudePuzzlePlayRecordDisplay = createPlayRecordDisplay({
  definition: hitofudePuzzlePlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseDifficultyLevel(comparisonKey);
    return difficulty ? getDifficultyLabel(difficulty) : null;
  },
  metrics: {
    "play-score": playScoreMetricPresentation,
    "time-delta-ms": timeDeltaMetricPresentation,
    "backtrack-count": createCountMetricPresentation("引き直し", "回"),
  },
});
