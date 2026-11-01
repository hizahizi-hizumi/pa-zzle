import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createScoreItemCriterion,
  describePenaltyScoreCriterion,
  describeSpeedScoreCriterion,
  formatOperationName,
  type SpeedFormulaTerm,
} from "@/components/game-result-score-criteria";
import type { NonogramResult } from "@/games/nonogram/play/use-nonogram-play";
import {
  NONOGRAM_REPAINT_PENALTY,
  NONOGRAM_SCORE_MAXIMUMS,
  NONOGRAM_SPEED_INITIAL_RECOGNITION_MS,
  NONOGRAM_SPEED_PER_FILLED_CELL_MS,
  NONOGRAM_SPEED_PER_LINE_MS,
  NONOGRAM_SPEED_PER_ROUND_MS,
} from "@/games/nonogram/score";

function listSpeedFormula({
  width,
  height,
  filledCellCount,
  roundCount,
}: NonogramResult["workload"]): SpeedFormulaTerm[] {
  return [
    { label: "盤面把握", durationMs: NONOGRAM_SPEED_INITIAL_RECOGNITION_MS },
    {
      label: "行・列",
      count: width + height,
      unit: "本",
      durationMsPerUnit: NONOGRAM_SPEED_PER_LINE_MS,
    },
    {
      label: "塗るマス",
      count: filledCellCount,
      unit: "マス",
      durationMsPerUnit: NONOGRAM_SPEED_PER_FILLED_CELL_MS,
    },
    {
      label: "連鎖の段",
      count: roundCount,
      unit: "回",
      durationMsPerUnit: NONOGRAM_SPEED_PER_ROUND_MS,
    },
  ];
}

export function getNonogramScoreCriteria(
  result: NonogramResult,
): GameResultScoreCriteria {
  return [
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: NONOGRAM_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
        formula: listSpeedFormula(result.workload),
        notes: [
          "連鎖の段は、決まったマスを使って次の行・列を読み進める回数で、この問題を仮置きなしに解くときに要る数。最初に読む1回も含む。",
        ],
      }),
    ),
    createScoreItemCriterion(
      "accuracy",
      describePenaltyScoreCriterion(
        NONOGRAM_SCORE_MAXIMUMS.accuracy,
        [
          {
            subject: "塗り直し",
            unit: "マス",
            points: NONOGRAM_REPAINT_PENALTY,
          },
        ],
        [
          `塗り直しは、塗ったマスを未確定か × に変えたマスの数で、${formatOperationName("undo")}で消えた塗りも数え、${formatOperationName("restart")}で消えた塗りは数えない。× の付け外しと、${formatOperationName("undo")}${formatOperationName("restart")}の回数では点を減らさない。`,
        ],
      ),
    ),
  ];
}
