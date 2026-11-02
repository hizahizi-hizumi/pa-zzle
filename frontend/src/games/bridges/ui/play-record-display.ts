import { bridgesPlayRecordDefinition } from "@/games/bridges/play-record";
import { getDifficultyLabel, parseDifficultyLevel } from "@/games/difficulty";
import {
  createCountProgressDisplay,
  createPlayRecordDisplay,
  elapsedTimeProgressDisplay,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/records/ui/play-record-display";

export const bridgesPlayRecordDisplay = createPlayRecordDisplay({
  definition: bridgesPlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseDifficultyLevel(comparisonKey);
    return difficulty ? getDifficultyLabel(difficulty) : null;
  },
  metrics: {
    "play-score": playScoreMetricPresentation,
    "time-delta-ms": timeDeltaMetricPresentation,
  },
  // 離脱までにどこまで架けていたかを、架けていた橋の本数で示す。解と照らさない数なので、正しい橋の数ではない。
  progress: {
    elapsedMs: elapsedTimeProgressDisplay,
    placedBridgeCount: createCountProgressDisplay("架けた橋", "本"),
  },
});
