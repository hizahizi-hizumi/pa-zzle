import { getDifficultyLabel, parseDifficultyLevel } from "@/games/difficulty";
import { tsumeShogiPlayRecordDefinition } from "@/games/tsume-shogi/play-record";
import {
  createCountMetricPresentation,
  createCountProgressDisplay,
  createPlayRecordDisplay,
  elapsedTimeProgressDisplay,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/records/ui/play-record-display";

export const tsumeShogiPlayRecordDisplay = createPlayRecordDisplay({
  definition: tsumeShogiPlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseDifficultyLevel(comparisonKey);
    return difficulty ? getDifficultyLabel(difficulty) : null;
  },
  metrics: {
    "play-score": playScoreMetricPresentation,
    "time-delta-ms": timeDeltaMetricPresentation,
    "wrong-check-count": createCountMetricPresentation("誤王手", "回"),
  },
  progress: {
    elapsedMs: elapsedTimeProgressDisplay,
    wrongCheckCount: createCountProgressDisplay("誤王手", "回"),
  },
});
