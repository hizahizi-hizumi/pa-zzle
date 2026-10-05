import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createOperationPenalty,
  createScoreItemCriterion,
  describePenaltyScoreCriterion,
  describeSpeedScoreCriterion,
} from "@/components/game-result-score-criteria";
import type { NanpureResult } from "@/games/nanpure/play/use-nanpure-play";
import {
  NANPURE_MISTAKE_PENALTY,
  NANPURE_RESTART_PENALTY,
  NANPURE_SCORE_MAXIMUMS,
  NANPURE_UNDO_PENALTY,
} from "@/games/nanpure/score";

export function getNanpureScoreCriteria(
  result: NanpureResult,
): GameResultScoreCriteria {
  return [
    createScoreItemCriterion(
      "accuracy",
      describePenaltyScoreCriterion(NANPURE_SCORE_MAXIMUMS.accuracy, [
        { subject: "ミス", unit: "回", points: NANPURE_MISTAKE_PENALTY },
      ]),
    ),
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: NANPURE_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
        notes: ["基準時間は全問で共通。"],
      }),
    ),
    createScoreItemCriterion(
      "stability",
      describePenaltyScoreCriterion(NANPURE_SCORE_MAXIMUMS.stability, [
        createOperationPenalty("undo", NANPURE_UNDO_PENALTY),
        createOperationPenalty("restart", NANPURE_RESTART_PENALTY),
      ]),
    ),
  ];
}
