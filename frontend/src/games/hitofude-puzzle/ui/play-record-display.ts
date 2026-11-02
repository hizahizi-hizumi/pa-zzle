import { getDifficultyLabel, parseDifficultyLevel } from "@/games/difficulty";
import { hitofudePuzzlePlayRecordDefinition } from "@/games/hitofude-puzzle/play-record";
import {
  createCountMetricPresentation,
  createPlayRecordDisplay,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/records/ui/play-record-display";

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
