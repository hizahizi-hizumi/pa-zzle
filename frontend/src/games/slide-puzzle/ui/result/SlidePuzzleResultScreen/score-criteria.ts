import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createScoreItemCriterion,
  describeSpeedScoreCriterion,
  formatOperationName,
} from "@/components/game-result-score-criteria";
import type { SlidePuzzleResult } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import {
  SLIDE_PUZZLE_SCORE_MAXIMUMS,
  SLIDE_PUZZLE_SPEED_PER_OPTIMAL_MOVE_MS,
  slidePuzzleSpeedInitialRecognitionMsByBoardSize,
} from "@/games/slide-puzzle/score";

export function getSlidePuzzleScoreCriteria(
  result: SlidePuzzleResult,
): GameResultScoreCriteria {
  const efficiencyMaximum = SLIDE_PUZZLE_SCORE_MAXIMUMS.efficiency;

  return [
    createScoreItemCriterion(
      "efficiency",
      `最短${result.optimalMoveCount}手で${efficiencyMaximum}点。総手数に対する最短手数の割合で配点し、${result.optimalMoveCount * 2}手で${efficiencyMaximum / 2}点。総手数には${formatOperationName("restart")}前の手も含む。`,
    ),
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: SLIDE_PUZZLE_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
        formula: [
          {
            label: "盤面把握",
            durationMs:
              slidePuzzleSpeedInitialRecognitionMsByBoardSize[result.boardSize],
          },
          {
            label: "最短",
            count: result.optimalMoveCount,
            unit: "手",
            durationMsPerUnit: SLIDE_PUZZLE_SPEED_PER_OPTIMAL_MOVE_MS,
          },
        ],
      }),
    ),
  ];
}
