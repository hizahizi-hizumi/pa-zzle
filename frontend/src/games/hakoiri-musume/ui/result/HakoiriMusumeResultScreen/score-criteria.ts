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
  return `最短${optimalMoveCount}手で${maximum}点。総手数が増えるほど (最短手数 + ${slack}) ÷ (総手数 + ${slack}) の割合で減らし、${halfScoreMoveCount}手で${maximum / 2}点。同じ駒を続けて動かした分は1手と数え、総手数には${formatOperationName("undo")}で取り消した手と${formatOperationName("restart")}前の手も含む。`;
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
            label: "よける順を読む",
            count: result.preparationLength,
            unit: "手",
            durationMsPerUnit: HAKOIRI_MUSUME_SPEED_PER_PREPARATION_MOVE_MS,
          },
        ],
        notes: [
          "よける順を読む手数は、自分の手順の数ではなく問題の値で、この問題を解くのに、娘を出口へ近づけられない手が最低でも続く長さ。1秒未満は切り上げる。",
        ],
      }),
    ),
  ];
}
