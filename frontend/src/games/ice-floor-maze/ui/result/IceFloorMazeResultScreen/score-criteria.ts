import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createScoreItemCriterion,
  describeSpeedScoreCriterion,
  formatOperationName,
} from "@/components/game-result-score-criteria";
import type { IceFloorMazeResult } from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import {
  countIceFloorMazeBoardCells,
  ICE_FLOOR_MAZE_SCORE_MAXIMUMS,
  ICE_FLOOR_MAZE_SPEED_PER_CELL_MS,
  ICE_FLOOR_MAZE_SPEED_PER_OPTIMAL_MOVE_MS,
} from "@/games/ice-floor-maze/score";

export function getIceFloorMazeScoreCriteria(
  result: IceFloorMazeResult,
): GameResultScoreCriteria {
  const efficiencyMaximum = ICE_FLOOR_MAZE_SCORE_MAXIMUMS.efficiency;

  return [
    createScoreItemCriterion(
      "efficiency",
      `最短${result.optimalMoveCount}手で${efficiencyMaximum}点。総手数に対する最短手数の割合で配点し、${result.optimalMoveCount * 2}手で${efficiencyMaximum / 2}点。総手数には${formatOperationName("undo")}で取り消した手と${formatOperationName("restart")}前の手も含む。`,
    ),
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: ICE_FLOOR_MAZE_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
        formula: [
          {
            label: "盤面",
            count: countIceFloorMazeBoardCells(result.boardShape),
            unit: "マス",
            durationMsPerUnit: ICE_FLOOR_MAZE_SPEED_PER_CELL_MS,
          },
          {
            label: "最短",
            count: result.optimalMoveCount,
            unit: "手",
            durationMsPerUnit: ICE_FLOOR_MAZE_SPEED_PER_OPTIMAL_MOVE_MS,
          },
        ],
      }),
    ),
  ];
}
