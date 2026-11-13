import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createScoreItemCriterion,
  describeSpeedScoreCriterion,
  formatOperationName,
} from "@/components/game-result-score-criteria";
import type { BridgesResult } from "@/games/bridges/play/use-bridges-play";
import { BRIDGES_SCORE_MAXIMUMS } from "@/games/bridges/score";

/** 内訳に並ぶ操作の回数は、どれも減点しないと名指しで言い切る。 */
export function getBridgesScoreCriteria(
  result: BridgesResult,
): GameResultScoreCriteria {
  return [
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: BRIDGES_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
        notes: [
          "基準時間は、この問題の島と橋の数と、考える所（数字だけでは決まらない所）の多さで決まる。",
          `${formatOperationName("undo")}・${formatOperationName("restart")}・架け直し・交わる橋に阻まれた回数では減点しない。`,
        ],
      }),
    ),
  ];
}
