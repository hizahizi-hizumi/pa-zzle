import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createScoreItemCriterion,
  describePenaltyScoreCriterion,
  describeSpeedScoreCriterion,
  formatOperationName,
} from "@/components/game-result-score-criteria";
import type { MagicSquareResult } from "@/games/magic-square/play/use-magic-square-play";
import {
  MAGIC_SQUARE_SCORE_MAXIMUMS,
  MAGIC_SQUARE_SPEED_INITIAL_RECOGNITION_MS,
  MAGIC_SQUARE_SPEED_PER_EMPTY_CELL_MS,
  MAGIC_SQUARE_WITHDRAWAL_PENALTY,
} from "@/games/magic-square/score";

export function getMagicSquareScoreCriteria(
  result: MagicSquareResult,
): GameResultScoreCriteria {
  return [
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: MAGIC_SQUARE_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
        formula: [
          {
            label: "読み始め",
            durationMs: MAGIC_SQUARE_SPEED_INITIAL_RECOGNITION_MS,
          },
          {
            label: "空き",
            count: result.workload.emptyCellCount,
            unit: "マス",
            durationMsPerUnit: MAGIC_SQUARE_SPEED_PER_EMPTY_CELL_MS,
          },
        ],
      }),
    ),
    createScoreItemCriterion(
      "accuracy",
      describePenaltyScoreCriterion(
        MAGIC_SQUARE_SCORE_MAXIMUMS.accuracy,
        [
          {
            subject: "置いた数の取り下げ",
            unit: "回",
            points: MAGIC_SQUARE_WITHDRAWAL_PENALTY,
          },
        ],
        [
          `外す・置き換える・${formatOperationName("undo")}・${formatOperationName("restart")}のどれで外れても数える。同じマスでほかのマスに触れる前に直した数は数えない。`,
        ],
      ),
    ),
  ];
}
