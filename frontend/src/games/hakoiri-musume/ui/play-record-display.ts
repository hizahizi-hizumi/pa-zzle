import { getDifficultyLabel, parseDifficultyLevel } from "@/games/difficulty";
import { hakoiriMusumePlayRecordDefinition } from "@/games/hakoiri-musume/play-record";
import {
  createPlayRecordDisplay,
  moveDeltaMetricPresentation,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/records/ui/play-record-display";

export const hakoiriMusumePlayRecordDisplay = createPlayRecordDisplay({
  definition: hakoiriMusumePlayRecordDefinition,
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
