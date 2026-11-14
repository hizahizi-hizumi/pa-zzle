import {
  createPlayRecordDisplay,
  moveDeltaMetricPresentation,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/features/records/ui/play-record-display";
import { getDifficultyLabel, parseDifficultyLevel } from "@/games/difficulty";
import { iceFloorMazePlayRecordDefinition } from "@/games/ice-floor-maze/play-record";

export const iceFloorMazePlayRecordDisplay = createPlayRecordDisplay({
  definition: iceFloorMazePlayRecordDefinition,
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
