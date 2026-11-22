import {
  createCountMetricPresentation,
  createPlayRecordDisplay,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/features/records/ui/play-record-display";
import {
  getDifficultyLabel,
  parseRecordedDifficulty,
} from "@/games/difficulty";
import { shuttleParkingPlayRecordDefinition } from "@/games/shuttle-parking/play-record";

export const shuttleParkingPlayRecordDisplay = createPlayRecordDisplay({
  definition: shuttleParkingPlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseRecordedDifficulty(comparisonKey);
    return difficulty ? getDifficultyLabel(difficulty) : null;
  },
  metrics: {
    "play-score": playScoreMetricPresentation,
    "time-delta-ms": timeDeltaMetricPresentation,
    "trap-count": createCountMetricPresentation("罠", "回"),
  },
});
