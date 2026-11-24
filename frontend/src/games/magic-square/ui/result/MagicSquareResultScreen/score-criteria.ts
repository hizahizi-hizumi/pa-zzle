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
          `置いた数は、外しても、置き換えても、${formatOperationName("undo")}・${formatOperationName("restart")}で外れても1回と数える。`,
          `列の端の色を変えなかった数は、ほかのマスを選ぶ前なら、外しても、置き換えても、${formatOperationName("undo")}で外れても数えない。`,
          "色を変えた数を、盤面の下に並んだ数で上下・左右・斜めに隣の数へすぐ置き換えたときも数えない。",
          `${formatOperationName("undo")}・${formatOperationName("restart")}は、押しただけでは減らさない。`,
        ],
      ),
    ),
  ];
}
