import {
  createPlayRecordDisplay,
  moveDeltaMetricPresentation,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/features/records/ui/play-record-display";
import {
  getDifficultyLabel,
  parseRecordedDifficulty,
} from "@/games/difficulty";
import { waterSortPlayRecordDefinition } from "@/games/water-sort/play-record";

export const waterSortPlayRecordDisplay = createPlayRecordDisplay({
  definition: waterSortPlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseRecordedDifficulty(comparisonKey);
    return difficulty ? getDifficultyLabel(difficulty) : null;
  },
  metrics: {
    "play-score": playScoreMetricPresentation,
    "time-delta-ms": timeDeltaMetricPresentation,
    "move-delta": moveDeltaMetricPresentation,
  },
});
