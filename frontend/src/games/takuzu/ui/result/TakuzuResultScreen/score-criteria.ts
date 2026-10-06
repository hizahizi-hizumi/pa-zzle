import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createOperationPenalty,
  createScoreItemCriterion,
  describePenaltyScoreCriterion,
  describeSpeedScoreCriterion,
  formatOperationName,
  type SpeedFormulaTerm,
} from "@/components/game-result-score-criteria";
import type { TakuzuResult } from "@/games/takuzu/play/use-takuzu-play";
import {
  TAKUZU_CORRECTION_PENALTY,
  TAKUZU_RESTART_PENALTY,
  TAKUZU_SCORE_MAXIMUMS,
  TAKUZU_SPEED_INITIAL_RECOGNITION_MS,
  TAKUZU_SPEED_PER_EMPTY_CELL_MS,
  TAKUZU_SPEED_PER_LINE_READING_ROUND_MS,
  TAKUZU_SPEED_PER_ROUND_MS,
  TAKUZU_UNDO_PENALTY,
} from "@/games/takuzu/score";

/** 基準時間の式。その問題で0回の項は省く。 */
function listSpeedFormula({
  emptyCellCount,
  roundCount,
  lineReadingRoundCount,
}: TakuzuResult["workload"]): SpeedFormulaTerm[] {
  return [
    { label: "盤面把握", durationMs: TAKUZU_SPEED_INITIAL_RECOGNITION_MS },
    {
      label: "空きマス",
      count: emptyCellCount,
      unit: "マス",
      durationMsPerUnit: TAKUZU_SPEED_PER_EMPTY_CELL_MS,
    },
    {
      label: "確定マスを探す局面",
      count: roundCount,
      unit: "回",
      durationMsPerUnit: TAKUZU_SPEED_PER_ROUND_MS,
    },
    ...(lineReadingRoundCount > 0
      ? [
          {
            label: "行・列を読む局面",
            count: lineReadingRoundCount,
            unit: "回",
            durationMsPerUnit: TAKUZU_SPEED_PER_LINE_READING_ROUND_MS,
          } as const,
        ]
      : []),
  ];
}

export function getTakuzuScoreCriteria(
  result: TakuzuResult,
): GameResultScoreCriteria {
  return [
    createScoreItemCriterion(
      "accuracy",
      describePenaltyScoreCriterion(
        TAKUZU_SCORE_MAXIMUMS.accuracy,
        [
          {
            subject: "置き直し",
            unit: "回",
            points: TAKUZU_CORRECTION_PENALTY,
          },
          createOperationPenalty("restart", TAKUZU_RESTART_PENALTY),
          createOperationPenalty("undo", TAKUZU_UNDO_PENALTY),
        ],
        [
          `置き直しは、一度置いたタイルを別のマスへ移ってから変えた回数で、続けて押してタイルを選ぶ間と、${formatOperationName("undo")}で取り消した操作は数えない。`,
        ],
      ),
    ),
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: TAKUZU_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
        formula: listSpeedFormula(result.workload),
        notes: [
          "局面の数は、この問題を推測なしに解くときに要る回数で、最初に探す1回も含む。",
        ],
      }),
    ),
  ];
}
