import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createScoreItemCriterion,
  describePenaltyScoreCriterion,
  describeSpeedScoreCriterion,
  formatOperationName,
  type SpeedFormulaTerm,
} from "@/components/game-result-score-criteria";
import type { HitofudePuzzleResult } from "@/games/hitofude-puzzle/play/use-hitofude-puzzle-play";
import {
  HITOFUDE_PUZZLE_BACKTRACK_PENALTY,
  HITOFUDE_PUZZLE_SCORE_MAXIMUMS,
  HITOFUDE_PUZZLE_SPEED_INITIAL_RECOGNITION_MS,
  HITOFUDE_PUZZLE_SPEED_PER_ASSUMPTION_MS,
  HITOFUDE_PUZZLE_SPEED_PER_FATAL_BRANCH_MS,
  HITOFUDE_PUZZLE_SPEED_PER_OPEN_CELL_MS,
  HITOFUDE_PUZZLE_SPEED_PER_REFUTATION_STEP_MS,
  HITOFUDE_PUZZLE_SPEED_REFUTATION_STEP_LIMIT,
} from "@/games/hitofude-puzzle/score";

/** 基準時間の式。その問題で0の項は省く。読む手数は上限で打ち切った値を示す。 */
function listSpeedFormula({
  openCellCount,
  fatalBranchCount,
  assumptionCount,
  refutationStepCount,
}: HitofudePuzzleResult["workload"]): SpeedFormulaTerm[] {
  return [
    {
      label: "盤面把握",
      durationMs: HITOFUDE_PUZZLE_SPEED_INITIAL_RECOGNITION_MS,
    },
    {
      label: "通るマス",
      count: openCellCount,
      unit: "マス",
      durationMsPerUnit: HITOFUDE_PUZZLE_SPEED_PER_OPEN_CELL_MS,
    },
    ...(fatalBranchCount > 0
      ? [
          {
            label: "分かれ道",
            count: fatalBranchCount,
            unit: "か所",
            durationMsPerUnit: HITOFUDE_PUZZLE_SPEED_PER_FATAL_BRANCH_MS,
          } as const,
        ]
      : []),
    ...(assumptionCount > 0
      ? [
          {
            label: "数手先を読む",
            count: assumptionCount,
            unit: "回",
            durationMsPerUnit: HITOFUDE_PUZZLE_SPEED_PER_ASSUMPTION_MS,
          } as const,
        ]
      : []),
    ...(refutationStepCount > 0
      ? [
          {
            label: "読む手数",
            count: Math.min(
              refutationStepCount,
              HITOFUDE_PUZZLE_SPEED_REFUTATION_STEP_LIMIT,
            ),
            unit: "手",
            durationMsPerUnit: HITOFUDE_PUZZLE_SPEED_PER_REFUTATION_STEP_MS,
          } as const,
        ]
      : []),
  ];
}

export function getHitofudePuzzleScoreCriteria(
  result: HitofudePuzzleResult,
): GameResultScoreCriteria {
  return [
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: HITOFUDE_PUZZLE_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
        formula: listSpeedFormula(result.workload),
        notes: [
          `式の数はこの問題で決まり、プレイでは変わらない。分かれ道は、進む向きを誤ると全マスを通れなくなる所。数手先を読む回数と読む手数は、この問題を盤面から読んで解くのに要る量（読む手数は${HITOFUDE_PUZZLE_SPEED_REFUTATION_STEP_LIMIT}手まで数える）。`,
        ],
      }),
    ),
    createScoreItemCriterion(
      "accuracy",
      describePenaltyScoreCriterion(
        HITOFUDE_PUZZLE_SCORE_MAXIMUMS.accuracy,
        [
          {
            subject: "引き直し",
            unit: "回",
            points: HITOFUDE_PUZZLE_BACKTRACK_PENALTY,
          },
        ],
        [
          `引き直しは、道を戻して前と違うマスへ引いた回数。戻して同じマスへ引いたときは数えない。${formatOperationName("undo")}・${formatOperationName("restart")}で戻したときも同じに数え、${formatOperationName("undo")}で前の道筋へ戻したときも1回と数える。`,
        ],
      ),
    ),
  ];
}
