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

/** 基準時間の式。その問題で0の項は省く。先読みで追う手は上限で打ち切った値を示す。 */
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
            label: "先読み",
            count: assumptionCount,
            unit: "回",
            durationMsPerUnit: HITOFUDE_PUZZLE_SPEED_PER_ASSUMPTION_MS,
          } as const,
        ]
      : []),
    ...(refutationStepCount > 0
      ? [
          {
            label: "先読みで追う手",
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

/** 基準時間の式の言葉の説明。式に出た項だけを説明する。 */
function listSpeedFormulaNotes({
  fatalBranchCount,
  assumptionCount,
  refutationStepCount,
}: HitofudePuzzleResult["workload"]): string[] {
  return [
    "式の数はこの問題の盤面で決まり、遊び方では変わらない。",
    ...(fatalBranchCount > 0
      ? ["分かれ道は、向きを間違えると全マスを通れなくなる所。"]
      : []),
    ...(assumptionCount > 0
      ? [
          "先読みは、角や通路だけでは道が決まらず、試しに数手先までたどって向きを決める所。",
        ]
      : []),
    ...(refutationStepCount > 0
      ? [
          `先読みで追う手は、そのとき試しにたどる手の合計（${HITOFUDE_PUZZLE_SPEED_REFUTATION_STEP_LIMIT}手を超える分は数えない）。`,
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
        notes: listSpeedFormulaNotes(result.workload),
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
          `引き直しは、道を戻してから前と違うマスへ引いた回数。戻して同じマスへ引き直したときは数えない。どの戻し方でも同じに数え、${formatOperationName("undo")}で前の道へ戻したときも1回と数える。`,
        ],
      ),
    ),
  ];
}
