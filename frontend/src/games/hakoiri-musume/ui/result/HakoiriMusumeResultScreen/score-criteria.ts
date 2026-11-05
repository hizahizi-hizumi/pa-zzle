import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createScoreItemCriterion,
  describeSpeedScoreCriterion,
  formatOperationName,
} from "@/components/game-result-score-criteria";
import type { HakoiriMusumeResult } from "@/games/hakoiri-musume/play/use-hakoiri-musume-play";
import {
  HAKOIRI_MUSUME_EFFICIENCY_SLACK_MOVES,
  HAKOIRI_MUSUME_SCORE_MAXIMUMS,
  HAKOIRI_MUSUME_SPEED_PER_OPTIMAL_MOVE_MS,
  HAKOIRI_MUSUME_SPEED_PER_PREPARATION_MOVE_MS,
  HAKOIRI_MUSUME_SPEED_READING_MS,
} from "@/games/hakoiri-musume/score";

function describeEfficiencyCriterion(optimalMoveCount: number): string {
  const maximum = HAKOIRI_MUSUME_SCORE_MAXIMUMS.efficiency;
  const slack = HAKOIRI_MUSUME_EFFICIENCY_SLACK_MOVES;
  const halfScoreMoveCount = optimalMoveCount * 2 + slack;
  return `最短${optimalMoveCount}手で${maximum}点。手数が増えるほど (最短手数 + ${slack}) ÷ (手数 + ${slack}) の割合で減らし、${halfScoreMoveCount}手で${maximum / 2}点。同じ駒を続けて動かした分は1手と数え、手数には${formatOperationName("undo")}で取り消した手と${formatOperationName("restart")}前の手も含む。`;
}

export function getHakoiriMusumeScoreCriteria(
  result: HakoiriMusumeResult,
): GameResultScoreCriteria {
  return [
    createScoreItemCriterion(
      "efficiency",
      describeEfficiencyCriterion(result.optimalMoveCount),
    ),
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: HAKOIRI_MUSUME_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
        formula: [
          { label: "盤面を読む", durationMs: HAKOIRI_MUSUME_SPEED_READING_MS },
          {
            label: "最短",
            count: result.optimalMoveCount,
            unit: "手",
            durationMsPerUnit: HAKOIRI_MUSUME_SPEED_PER_OPTIMAL_MOVE_MS,
          },
          {
            label: "娘を進める前に読む",
            count: result.preparationLength,
            unit: "手",
            durationMsPerUnit: HAKOIRI_MUSUME_SPEED_PER_PREPARATION_MOVE_MS,
          },
        ],
      }),
    ),
  ];
}
