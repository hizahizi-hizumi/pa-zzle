import { getDifficultyLabel, parseDifficultyLevel } from "@/games/difficulty";
import { hitofudePuzzlePlayRecordDefinition } from "@/games/hitofude-puzzle/play-record";
import {
  createCountMetricPresentation,
  createCountProgressDisplay,
  createPlayRecordDisplay,
  elapsedTimeProgressDisplay,
  playScoreMetricPresentation,
  timeDeltaMetricPresentation,
} from "@/records/ui/play-record-display";

export const hitofudePuzzlePlayRecordDisplay = createPlayRecordDisplay({
  definition: hitofudePuzzlePlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseDifficultyLevel(comparisonKey);
    return difficulty ? getDifficultyLabel(difficulty) : null;
  },
  metrics: {
    "play-score": playScoreMetricPresentation,
    "time-delta-ms": timeDeltaMetricPresentation,
    // 自己ベストの更新幅は「引き直し 3回減」では何が減ったか読みにくいので、「3回少ない」と書く。
    "backtrack-count": {
      ...createCountMetricPresentation("引き直し", "回"),
      formatImprovement(amount: number) {
        return `${amount}回少ない`;
      },
    },
  },
  // 離脱までに道がどこまで届いたかを、道が通ったマスの数（始点を含む）で示す。
  progress: {
    elapsedMs: elapsedTimeProgressDisplay,
    visitedCellCount: createCountProgressDisplay("通ったマス", "マス"),
    backtrackCount: createCountProgressDisplay("引き直し", "回"),
  },
});
