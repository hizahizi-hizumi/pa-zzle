import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createScoreItemCriterion,
  describePenaltyScoreCriterion,
  describeSpeedScoreCriterion,
  formatOperationName,
  type SpeedFormulaTerm,
} from "@/components/game-result-score-criteria";
import type { HamiltonianPathResult } from "@/games/hamiltonian-path/play/use-hamiltonian-path-play";
import {
  HAMILTONIAN_PATH_BACKTRACK_PENALTY,
  HAMILTONIAN_PATH_SCORE_MAXIMUMS,
  HAMILTONIAN_PATH_SPEED_INITIAL_RECOGNITION_MS,
  HAMILTONIAN_PATH_SPEED_PER_ASSUMPTION_MS,
  HAMILTONIAN_PATH_SPEED_PER_FATAL_BRANCH_MS,
  HAMILTONIAN_PATH_SPEED_PER_OPEN_CELL_MS,
  HAMILTONIAN_PATH_SPEED_PER_REFUTATION_STEP_MS,
  HAMILTONIAN_PATH_SPEED_REFUTATION_STEP_LIMIT,
} from "@/games/hamiltonian-path/score";

/** 基準時間の式。その問題で0の項は省く。先読みの手数は上限で打ち切った値を示す。 */
function listSpeedFormula({
  openCellCount,
  fatalBranchCount,
  assumptionCount,
  refutationStepCount,
}: HamiltonianPathResult["workload"]): SpeedFormulaTerm[] {
  return [
    {
      label: "盤面把握",
      durationMs: HAMILTONIAN_PATH_SPEED_INITIAL_RECOGNITION_MS,
    },
    {
      label: "なぞるマス",
      count: openCellCount,
      unit: "マス",
      durationMsPerUnit: HAMILTONIAN_PATH_SPEED_PER_OPEN_CELL_MS,
    },
    ...(fatalBranchCount > 0
      ? [
          {
            label: "迷う分岐",
            count: fatalBranchCount,
            unit: "か所",
            durationMsPerUnit: HAMILTONIAN_PATH_SPEED_PER_FATAL_BRANCH_MS,
          } as const,
        ]
      : []),
    ...(assumptionCount > 0
      ? [
          {
            label: "先読み",
            count: assumptionCount,
            unit: "回",
            durationMsPerUnit: HAMILTONIAN_PATH_SPEED_PER_ASSUMPTION_MS,
          } as const,
        ]
      : []),
    ...(refutationStepCount > 0
      ? [
          {
            label: "先読みの手数",
            count: Math.min(
              refutationStepCount,
              HAMILTONIAN_PATH_SPEED_REFUTATION_STEP_LIMIT,
            ),
            unit: "手",
            durationMsPerUnit: HAMILTONIAN_PATH_SPEED_PER_REFUTATION_STEP_MS,
          } as const,
        ]
      : []),
  ];
}

export function getHamiltonianPathScoreCriteria(
  result: HamiltonianPathResult,
): GameResultScoreCriteria {
  return [
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: HAMILTONIAN_PATH_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
        formula: listSpeedFormula(result.workload),
        notes: [
          `迷う分岐は、始点から引き進めると全マスを通れなくなる向きを含む分岐。先読みの回数と手数は、この問題を盤面から読んで解くときに要る数（手数は${HAMILTONIAN_PATH_SPEED_REFUTATION_STEP_LIMIT}手まで数える）。`,
        ],
      }),
    ),
    createScoreItemCriterion(
      "accuracy",
      describePenaltyScoreCriterion(
        HAMILTONIAN_PATH_SCORE_MAXIMUMS.accuracy,
        [
          {
            subject: "引き直し",
            unit: "回",
            points: HAMILTONIAN_PATH_BACKTRACK_PENALTY,
          },
        ],
        [
          `引き直しは、一度引いた道を戻して前と別のマスへ引いた回数で、戻して同じマスへ引き直したときは数えない。${formatOperationName("undo")}・${formatOperationName("restart")}で戻した後も同じに数え、${formatOperationName("undo")}で引き直す前の道筋へ戻したことも引き直しに数える。`,
        ],
      ),
    ),
  ];
}
