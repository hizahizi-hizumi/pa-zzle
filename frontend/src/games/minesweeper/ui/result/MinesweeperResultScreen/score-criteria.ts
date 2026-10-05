import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createScoreItemCriterion,
  describePenaltyScoreCriterion,
  describeSpeedScoreCriterion,
} from "@/components/game-result-score-criteria";
import type { MinesweeperResult } from "@/games/minesweeper/play/use-minesweeper-play";
import {
  MINESWEEPER_MISTAKE_PENALTY,
  MINESWEEPER_SCORE_MAXIMUMS,
  MINESWEEPER_SPEED_INITIAL_RECOGNITION_MS,
  MINESWEEPER_SPEED_PER_MINE_MS,
  MINESWEEPER_SPEED_PER_MINIMUM_OPEN_MS,
} from "@/games/minesweeper/score";

export function getMinesweeperScoreCriteria(
  result: MinesweeperResult,
): GameResultScoreCriteria {
  return [
    createScoreItemCriterion(
      "accuracy",
      describePenaltyScoreCriterion(MINESWEEPER_SCORE_MAXIMUMS.accuracy, [
        {
          subject: "踏んだ地雷",
          unit: "個",
          points: MINESWEEPER_MISTAKE_PENALTY,
        },
      ]),
    ),
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: MINESWEEPER_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
        formula: [
          {
            label: "盤面把握",
            durationMs: MINESWEEPER_SPEED_INITIAL_RECOGNITION_MS,
          },
          {
            label: "開く操作の最小",
            count: result.minimumOpenCount,
            unit: "回",
            durationMsPerUnit: MINESWEEPER_SPEED_PER_MINIMUM_OPEN_MS,
          },
          {
            label: "地雷",
            count: result.mineCount,
            unit: "個",
            durationMsPerUnit: MINESWEEPER_SPEED_PER_MINE_MS,
          },
        ],
      }),
    ),
  ];
}
