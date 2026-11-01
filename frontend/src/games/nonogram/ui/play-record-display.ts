import { getDifficultyLabel, parseDifficultyLevel } from "@/games/difficulty";
import { nonogramPlayRecordDefinition } from "@/games/nonogram/play-record";
import {
  createCountMetricPresentation,
  createCountProgressDisplay,
  createPlayRecordDisplay,
  elapsedTimeProgressDisplay,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/records/ui/play-record-display";

export const nonogramPlayRecordDisplay = createPlayRecordDisplay({
  definition: nonogramPlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseDifficultyLevel(comparisonKey);
    return difficulty ? getDifficultyLabel(difficulty) : null;
  },
  metrics: {
    "play-score": playScoreMetricPresentation,
    "time-delta-ms": timeDeltaMetricPresentation,
    "repaint-count": createCountMetricPresentation("塗り直し", "マス"),
  },
  progress: {
    elapsedMs: elapsedTimeProgressDisplay,
    repaintCount: createCountProgressDisplay("塗り直し", "マス"),
  },
});
