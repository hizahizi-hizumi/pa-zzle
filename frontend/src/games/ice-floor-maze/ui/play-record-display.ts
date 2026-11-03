import { getDifficultyLabel, parseDifficultyLevel } from "@/games/difficulty";
import { iceFloorMazePlayRecordDefinition } from "@/games/ice-floor-maze/play-record";
import {
  createCountProgressDisplay,
  createPlayRecordDisplay,
  elapsedTimeProgressDisplay,
  moveDeltaMetricPresentation,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/records/ui/play-record-display";

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
  progress: {
    elapsedMs: elapsedTimeProgressDisplay,
    moveCount: createCountProgressDisplay("手数", "手"),
  },
});
