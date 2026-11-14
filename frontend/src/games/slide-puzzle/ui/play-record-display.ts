import {
  createPlayRecordDisplay,
  moveDeltaMetricPresentation,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/features/records/ui/play-record-display";
import { getDifficultyLabel, parseDifficultyLevel } from "@/games/difficulty";
import { slidePuzzlePlayRecordDefinition } from "@/games/slide-puzzle/play-record";

export const slidePuzzlePlayRecordDisplay = createPlayRecordDisplay({
  definition: slidePuzzlePlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseDifficultyLevel(comparisonKey);
    return difficulty ? getDifficultyLabel(difficulty) : null;
  },
  metrics: {
    "play-score": playScoreMetricPresentation,
    "time-delta-ms": timeDeltaMetricPresentation,
    "move-delta": moveDeltaMetricPresentation,
  },
});
