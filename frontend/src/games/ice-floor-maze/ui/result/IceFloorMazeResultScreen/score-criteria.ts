import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createScoreItemCriterion,
  describeSpeedScoreCriterion,
  formatOperationName,
  type SpeedFormulaTerm,
} from "@/components/game-result-score-criteria";
import type { IceFloorMazeResult } from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import {
  ICE_FLOOR_MAZE_EFFICIENCY_SLACK_MOVES,
  ICE_FLOOR_MAZE_SCORE_MAXIMUMS,
  ICE_FLOOR_MAZE_SPEED_PER_CELL_MS,
  ICE_FLOOR_MAZE_SPEED_PER_ELEMENT_MS,
  ICE_FLOOR_MAZE_SPEED_PER_OPTIMAL_MOVE_MS,
} from "@/games/ice-floor-maze/score";

function describeEfficiencyCriterion(optimalMoveCount: number): string {
  const maximum = ICE_FLOOR_MAZE_SCORE_MAXIMUMS.efficiency;
  const slack = ICE_FLOOR_MAZE_EFFICIENCY_SLACK_MOVES;
  const halfScoreMoveCount = optimalMoveCount * 2 + slack;
  return `最短${optimalMoveCount}手で${maximum}点。総手数が増えるほど (最短手数 + ${slack}) ÷ (総手数 + ${slack}) の割合で減らし、${halfScoreMoveCount}手で${maximum / 2}点。総手数には${formatOperationName("undo")}で取り消した手と${formatOperationName("restart")}前の手も含む。`;
}

function listSpeedFormula({
  speedReference,
  optimalMoveCount,
}: IceFloorMazeResult): SpeedFormulaTerm[] {
  return [
    {
      label: "盤面",
      count: speedReference.drawnCellCount,
      unit: "マス",
      durationMsPerUnit: ICE_FLOOR_MAZE_SPEED_PER_CELL_MS,
    },
    {
      label: "最短",
      count: optimalMoveCount,
      unit: "手",
      durationMsPerUnit: ICE_FLOOR_MAZE_SPEED_PER_OPTIMAL_MOVE_MS,
    },
    ...(speedReference.elementCount > 0
      ? [
          {
            label: "もろい岩・薄い氷",
            count: speedReference.elementCount,
            unit: "個",
            durationMsPerUnit: ICE_FLOOR_MAZE_SPEED_PER_ELEMENT_MS,
          } as const,
        ]
      : []),
  ];
}

export function getIceFloorMazeScoreCriteria(
  result: IceFloorMazeResult,
): GameResultScoreCriteria {
  return [
    createScoreItemCriterion(
      "efficiency",
      describeEfficiencyCriterion(result.optimalMoveCount),
    ),
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: ICE_FLOOR_MAZE_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
        formula: listSpeedFormula(result),
      }),
    ),
  ];
}
