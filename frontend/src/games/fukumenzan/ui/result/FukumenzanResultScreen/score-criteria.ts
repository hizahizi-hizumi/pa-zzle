import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createScoreItemCriterion,
  describeSpeedScoreCriterion,
  formatOperationName,
} from "@/components/game-result-score-criteria";
import type { FukumenzanResult } from "@/games/fukumenzan/play/use-fukumenzan-play";
import { FUKUMENZAN_SCORE_MAXIMUMS } from "@/games/fukumenzan/score";

/** 内訳に並ぶ操作の回数は、どれも減点しないと名指しで言い切る。 */
export function getFukumenzanScoreCriteria(
  result: FukumenzanResult,
): GameResultScoreCriteria {
  return [
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: FUKUMENZAN_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
        notes: [
          "基準時間は、この問題の文字の種類と、式に書かれた文字の数で決まる。",
          `${formatOperationName("undo")}・${formatOperationName("restart")}・札の入れ直し・× の数では減点しない。`,
        ],
      }),
    ),
  ];
}
