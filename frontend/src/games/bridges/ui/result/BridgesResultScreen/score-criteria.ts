import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createOperationPenalty,
  createScoreItemCriterion,
  describePenaltyScoreCriterion,
  describeSpeedScoreCriterion,
  formatOperationName,
} from "@/components/game-result-score-criteria";
import type { BridgesResult } from "@/games/bridges/play/use-bridges-play";
import {
  BRIDGES_RESTART_PENALTY,
  BRIDGES_RETRACTION_PENALTY,
  BRIDGES_SCORE_MAXIMUMS,
  BRIDGES_UNDO_PENALTY,
} from "@/games/bridges/score";

export function getBridgesScoreCriteria(
  result: BridgesResult,
): GameResultScoreCriteria {
  return [
    createScoreItemCriterion(
      "accuracy",
      describePenaltyScoreCriterion(
        BRIDGES_SCORE_MAXIMUMS.accuracy,
        [
          {
            subject: "橋の訂正",
            unit: "回",
            points: BRIDGES_RETRACTION_PENALTY,
          },
          createOperationPenalty("restart", BRIDGES_RESTART_PENALTY),
          createOperationPenalty("undo", BRIDGES_UNDO_PENALTY),
        ],
        [
          `橋の訂正は、別の辺へ移ってから確定済みの橋を減らした回数。同じ辺を続けて押して本数を選ぶ間と、${formatOperationName("undo")}で取り消した操作は訂正に数えない。1本から2本への追加も数えない。`,
        ],
      ),
    ),
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: BRIDGES_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
        notes: [
          "基準時間は、この問題の島と橋の数と、考える所（数字だけでは決まらない所）の多さで決まる。",
          "交わる橋に阻まれた回数と、橋の入力回数そのものは減点しない。",
        ],
      }),
    ),
  ];
}
