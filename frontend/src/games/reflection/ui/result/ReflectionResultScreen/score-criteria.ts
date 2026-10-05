import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import { formatScoreReferenceTime } from "@/components/game-result-metrics";
import {
  createScoreItemCriterion,
  describeSpeedScoreCriterion,
  formatOperationName,
  formatSpeedFormula,
  type SpeedFormulaTerm,
} from "@/components/game-result-score-criteria";
import type { ReflectionResult } from "@/games/reflection/play/use-reflection-play";
import {
  calculateReflectionReadingMs,
  calculateReflectionTrialMs,
  REFLECTION_SCORE_MAXIMUMS,
  REFLECTION_SPEED_ASSUMPTION_TEST_LIMIT,
  REFLECTION_SPEED_PER_ASSUMPTION_TEST_MS,
  REFLECTION_SPEED_PER_CLUE_MS,
  REFLECTION_SPEED_PER_PIECE_MS,
  REFLECTION_SPEED_PER_PROPAGATION_ROUND_MS,
  REFLECTION_SPEED_PER_TRIAL_MOVE_MS,
} from "@/games/reflection/score";

type ReflectionWorkload = ReflectionResult["workload"];

function createClueTerm({ clueCount }: ReflectionWorkload): SpeedFormulaTerm {
  return {
    label: "外周ヒント",
    count: clueCount,
    unit: "本",
    durationMsPerUnit: REFLECTION_SPEED_PER_CLUE_MS,
  };
}

/** 読んで解く時間の式。その問題で0回の項は省く。仮に置いて確かめる回数は上限で打ち切った値を示す。 */
function listReadingFormula(workload: ReflectionWorkload): SpeedFormulaTerm[] {
  const { pieceCount, propagationRoundCount, assumptionTestCount } = workload;
  return [
    createClueTerm(workload),
    {
      label: "ピース",
      count: pieceCount,
      unit: "個",
      durationMsPerUnit: REFLECTION_SPEED_PER_PIECE_MS,
    },
    ...(propagationRoundCount > 0
      ? [
          {
            label: "照らし直す局面",
            count: propagationRoundCount,
            unit: "回",
            durationMsPerUnit: REFLECTION_SPEED_PER_PROPAGATION_ROUND_MS,
          } as const,
        ]
      : []),
    ...(assumptionTestCount > 0
      ? [
          {
            label: "仮に置いて確かめる",
            count: Math.min(
              assumptionTestCount,
              REFLECTION_SPEED_ASSUMPTION_TEST_LIMIT,
            ),
            unit: "回",
            durationMsPerUnit: REFLECTION_SPEED_PER_ASSUMPTION_TEST_MS,
          } as const,
        ]
      : []),
  ];
}

/** 基準時間の決め方。試し置きの方が速い問題では、読む時間と試し置きの時間の中間になる。 */
function describeSpeedFullScoreRule(workload: ReflectionWorkload): string {
  const readingMs = calculateReflectionReadingMs(workload);
  const reading = `読んで解く時間${formatScoreReferenceTime(readingMs)}（${formatSpeedFormula(listReadingFormula(workload))}）`;
  const trialMs = calculateReflectionTrialMs(workload);
  if (workload.trialMoveCount === null || trialMs >= readingMs) {
    return `基準時間は${reading}。`;
  }
  const trialFormula = formatSpeedFormula([
    createClueTerm(workload),
    {
      label: "試し置き",
      count: workload.trialMoveCount,
      unit: "手",
      durationMsPerUnit: REFLECTION_SPEED_PER_TRIAL_MOVE_MS,
    },
  ]);
  const trial = `一致表示を見ながら試し置きで解く時間${formatScoreReferenceTime(trialMs)}（${trialFormula}）`;
  return `基準時間は${reading}と、${trial}の中間。`;
}

export function getReflectionScoreCriteria(
  result: ReflectionResult,
): GameResultScoreCriteria {
  return [
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: REFLECTION_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
        notes: [
          describeSpeedFullScoreRule(result.workload),
          `局面と仮に置く回数は、この問題を外周ヒントから読んで解くときに要る回数（仮に置く回数は${REFLECTION_SPEED_ASSUMPTION_TEST_LIMIT}回まで数える）。`,
        ],
      }),
    ),
    {
      label: "点に入らないもの",
      description: `置き直し・${formatOperationName("restart")}・光路を確かめた回数は点に入らない。置いて確かめ、動かして直しても減点しない。`,
    },
  ];
}
