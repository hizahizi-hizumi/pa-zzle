import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createScoreItemCriterion,
  describeSpeedScoreCriterion,
  formatOperationName,
} from "@/components/game-result-score-criteria";
import type { BridgesResult } from "@/games/bridges/play/use-bridges-play";
import { BRIDGES_SCORE_MAXIMUMS } from "@/games/bridges/score";

/**
 * 速さだけで採点する。基準時間の式の項は遊ぶ人が盤面から数えられないので並べず、何から決まるかだけを1文で示す。
 * 内訳に並ぶ操作の回数は、どれも減点しないと名指しで言い切る。
 * 架け直し・待った・盤面を戻すは時間にだけ表れる。
 */
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
