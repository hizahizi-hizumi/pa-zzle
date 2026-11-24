import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createScoreItemCriterion,
  describePenaltyScoreCriterion,
  describeSpeedScoreCriterion,
  formatOperationName,
} from "@/components/game-result-score-criteria";
import type { SolitaireResult } from "@/games/solitaire/play/use-solitaire-play";
import {
  SOLITAIRE_RETRACTED_MOVE_PENALTY,
  SOLITAIRE_SCORE_MAXIMUMS,
} from "@/games/solitaire/score";
import { SOLITAIRE_RETRACTED_MOVE_LABEL } from "@/games/solitaire/ui/score-vocabulary";

export function getSolitaireScoreCriteria(
  result: SolitaireResult,
): GameResultScoreCriteria {
  return [
    createScoreItemCriterion(
      "stability",
      describePenaltyScoreCriterion(
        SOLITAIRE_SCORE_MAXIMUMS.stability,
        [
          {
            subject: SOLITAIRE_RETRACTED_MOVE_LABEL,
            unit: "手",
            points: SOLITAIRE_RETRACTED_MOVE_PENALTY,
          },
        ],
        [
          `取り消した手は、${formatOperationName("undo")}で戻した手と、${formatOperationName("restart")}でなくなった手。山札をめくる手と捨て札を山札へ戻す手は数えない。`,
        ],
      ),
    ),
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: SOLITAIRE_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
      }),
    ),
  ];
}
