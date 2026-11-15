import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createScoreItemCriterion,
  describeLinearScoreCriterion,
  describeSpeedScoreCriterion,
} from "@/components/game-result-score-criteria";
import type { WaterSortResult } from "@/games/water-sort/play/use-water-sort-play";
import {
  WATER_SORT_SCORE_MAXIMUMS,
  WATER_SORT_SPEED_INITIAL_RECOGNITION_MS,
  WATER_SORT_SPEED_PER_COLOR_MS,
  WATER_SORT_SPEED_PER_OPTIMAL_MOVE_MS,
} from "@/games/water-sort/score";

export function getWaterSortScoreCriteria(
  result: WaterSortResult,
): GameResultScoreCriteria {
  return [
    createScoreItemCriterion(
      "efficiency",
      describeLinearScoreCriterion({
        maximum: WATER_SORT_SCORE_MAXIMUMS.efficiency,
        fullScoreCondition: `最短${result.optimalMoveCount}手`,
        zeroScoreCondition: `${result.optimalMoveCount * 3}手以上`,
        basis: "総手数（取り消した注ぎも含む）",
      }),
    ),
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: WATER_SORT_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
        formula: [
          {
            label: "盤面把握",
            durationMs: WATER_SORT_SPEED_INITIAL_RECOGNITION_MS,
          },
          {
            count: result.colorCount,
            unit: "色",
            durationMsPerUnit: WATER_SORT_SPEED_PER_COLOR_MS,
          },
          {
            label: "最短",
            count: result.optimalMoveCount,
            unit: "手",
            durationMsPerUnit: WATER_SORT_SPEED_PER_OPTIMAL_MOVE_MS,
          },
        ],
      }),
    ),
  ];
}
