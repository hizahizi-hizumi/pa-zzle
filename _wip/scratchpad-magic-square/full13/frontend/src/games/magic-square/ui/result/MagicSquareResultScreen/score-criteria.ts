import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createScoreItemCriterion,
  describePenaltyScoreCriterion,
  describeSpeedScoreCriterion,
  formatOperationName,
} from "@/components/game-result-score-criteria";
import type { MagicSquareResult } from "@/games/magic-square/play/use-magic-square-play";
import {
  MAGIC_SQUARE_CORRECTION_PENALTY,
  MAGIC_SQUARE_SCORE_MAXIMUMS,
  MAGIC_SQUARE_SPEED_INITIAL_RECOGNITION_MS,
  MAGIC_SQUARE_SPEED_PER_EMPTY_CELL_MS,
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
            subject: "置き直し",
            unit: "回",
            points: MAGIC_SQUARE_CORRECTION_PENALTY,
          },
        ],
        [
          `置いた数が外れるたびに1回と数える。外す・置き換える・${formatOperationName("undo")}・${formatOperationName("restart")}のどれで外れても同じ。`,
          `ただし、置いてからほかのマスを選ぶ前に直した数は、その数で列の端の色が変わっていなければ数えない。${formatOperationName("restart")}で外れた数はどれも数える。`,
          `${formatOperationName("undo")}・${formatOperationName("restart")}を押した回数では減らさない。`,
        ],
      ),
    ),
  ];
}
