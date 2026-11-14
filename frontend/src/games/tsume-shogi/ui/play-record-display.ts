import {
  createCountMetricPresentation,
  createPlayRecordDisplay,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/features/records/ui/play-record-display";
import { getDifficultyLabel, parseDifficultyLevel } from "@/games/difficulty";
import { tsumeShogiPlayRecordDefinition } from "@/games/tsume-shogi/play-record";

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
