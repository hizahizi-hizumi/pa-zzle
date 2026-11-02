import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createScoreItemCriterion,
  describePenaltyScoreCriterion,
  describeSpeedScoreCriterion,
  formatOperationName,
  type SpeedFormulaTerm,
} from "@/components/game-result-score-criteria";
import type { TsumeShogiResult } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import {
  countTsumeShogiAttackerMoves,
  TSUME_SHOGI_SCORE_MAXIMUMS,
  TSUME_SHOGI_SPEED_DEEP_DECOY_LIMIT,
  TSUME_SHOGI_SPEED_INITIAL_RECOGNITION_MS,
  TSUME_SHOGI_SPEED_PER_ATTACKER_MOVE_MS,
  TSUME_SHOGI_SPEED_PER_DEEP_DECOY_MS,
  TSUME_SHOGI_SPEED_PER_PLAUSIBLE_WRONG_MS,
  TSUME_SHOGI_SPEED_PER_ROOT_CHECK_MS,
  TSUME_SHOGI_SPEED_PLAUSIBLE_WRONG_LIMIT,
  TSUME_SHOGI_WRONG_CHECK_PENALTY,
} from "@/games/tsume-shogi/score";

/** 基準時間の式。その問題で0の項は省き、誤王手と紛れの数は上限で打ち切った値を示す。 */
function listSpeedFormula({
  plies,
  rootChecks,
  plausibleWrong,
  deepDecoyCount,
}: TsumeShogiResult["workload"]): SpeedFormulaTerm[] {
  return [
    {
      label: "盤面を見渡す",
      durationMs: TSUME_SHOGI_SPEED_INITIAL_RECOGNITION_MS,
    },
    {
      label: "攻方の手",
      count: countTsumeShogiAttackerMoves(plies),
      unit: "手",
      durationMsPerUnit: TSUME_SHOGI_SPEED_PER_ATTACKER_MOVE_MS,
    },
    {
      label: "初手の王手",
      count: rootChecks,
      unit: "個",
      durationMsPerUnit: TSUME_SHOGI_SPEED_PER_ROOT_CHECK_MS,
    },
    ...(plausibleWrong > 0
      ? [
          {
            label: "効いていそうな誤王手",
            count: Math.min(
              plausibleWrong,
              TSUME_SHOGI_SPEED_PLAUSIBLE_WRONG_LIMIT,
            ),
            unit: "個",
            durationMsPerUnit: TSUME_SHOGI_SPEED_PER_PLAUSIBLE_WRONG_MS,
          } as const,
        ]
      : []),
    ...(deepDecoyCount > 0
      ? [
          {
            label: "数手先まで続く紛れ",
            count: Math.min(deepDecoyCount, TSUME_SHOGI_SPEED_DEEP_DECOY_LIMIT),
            unit: "個",
            durationMsPerUnit: TSUME_SHOGI_SPEED_PER_DEEP_DECOY_MS,
          } as const,
        ]
      : []),
  ];
}

export function getTsumeShogiScoreCriteria(
  result: TsumeShogiResult,
): GameResultScoreCriteria {
  return [
    createScoreItemCriterion(
      "accuracy",
      describePenaltyScoreCriterion(
        TSUME_SHOGI_SCORE_MAXIMUMS.accuracy,
        [
          {
            subject: "誤王手",
            unit: "回",
            points: TSUME_SHOGI_WRONG_CHECK_PENALTY,
          },
        ],
        [
          "0点を下回らない。誤王手は、詰む筋から指した、残りの手数では詰まない王手。反証の筋で続けた王手は数えない。",
        ],
      ),
    ),
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: TSUME_SHOGI_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
        formula: listSpeedFormula(result.workload),
        notes: [
          `効いていそうな誤王手と数手先まで続く紛れは、この問題を指す前に読んで捨てる候補の数（それぞれ${TSUME_SHOGI_SPEED_PLAUSIBLE_WRONG_LIMIT}個・${TSUME_SHOGI_SPEED_DEEP_DECOY_LIMIT}個まで数える）。`,
        ],
      }),
    ),
    {
      label: "点に入らないもの",
      description: `反証を見た回数・${formatOperationName("undo")}・${formatOperationName("restart")}・指せない手を押した回数は点に入らない。`,
    },
  ];
}
