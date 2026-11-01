import { getDifficultyLabel, parseDifficultyLevel } from "@/games/difficulty";
import { hamiltonianPathPlayRecordDefinition } from "@/games/hamiltonian-path/play-record";
import {
  createCountMetricPresentation,
  createCountProgressDisplay,
  createPlayRecordDisplay,
  elapsedTimeProgressDisplay,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/records/ui/play-record-display";

export const hamiltonianPathPlayRecordDisplay = createPlayRecordDisplay({
  definition: hamiltonianPathPlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseDifficultyLevel(comparisonKey);
    return difficulty ? getDifficultyLabel(difficulty) : null;
  },
  metrics: {
    "play-score": playScoreMetricPresentation,
    "time-delta-ms": timeDeltaMetricPresentation,
    "backtrack-count": createCountMetricPresentation("引き直し", "回"),
  },
  // 離脱までに道がどこまで届いたかを、道が通ったマスの数（始点を含む）で示す。
  progress: {
    elapsedMs: elapsedTimeProgressDisplay,
    visitedCellCount: createCountProgressDisplay("通ったマス", "マス"),
    backtrackCount: createCountProgressDisplay("引き直し", "回"),
  },
});
