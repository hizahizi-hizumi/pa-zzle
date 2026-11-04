import { getDifficultyLabel, parseDifficultyLevel } from "@/games/difficulty";
import { tsumeShogiPlayRecordDefinition } from "@/games/tsume-shogi/play-record";
import {
  createCountMetricPresentation,
  createPlayRecordDisplay,
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
});
