import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createScoreItemCriterion,
  describeSpeedScoreCriterion,
  type SpeedFormulaTerm,
} from "@/components/game-result-score-criteria";
import type { BridgesResult } from "@/games/bridges/play/use-bridges-play";
import {
  BRIDGES_SCORE_MAXIMUMS,
  BRIDGES_SPEED_INITIAL_RECOGNITION_MS,
  BRIDGES_SPEED_PER_BRIDGE_MS,
  BRIDGES_SPEED_PER_CONNECTIVITY_ROUND_MS,
  BRIDGES_SPEED_PER_COUNT_ROUND_MS,
  BRIDGES_SPEED_PER_ISLAND_MS,
  BRIDGES_SPEED_PER_UNDECIDED_EDGE_MS,
} from "@/games/bridges/score";

type BridgesWorkload = BridgesResult["workload"];

/** 基準時間の式。その問題で0の項は省く。 */
function listSpeedFormula({
  islandCount,
  bridgeCount,
  countRoundCount,
  connectivityRoundCount,
  countReasoningUndecidedEdgeCount,
}: BridgesWorkload): SpeedFormulaTerm[] {
  return [
    { label: "盤面把握", durationMs: BRIDGES_SPEED_INITIAL_RECOGNITION_MS },
    {
      label: "島",
      count: islandCount,
      unit: "個",
      durationMsPerUnit: BRIDGES_SPEED_PER_ISLAND_MS,
    },
    {
      label: "橋",
      count: bridgeCount,
      unit: "本",
      durationMsPerUnit: BRIDGES_SPEED_PER_BRIDGE_MS,
    },
    ...(countRoundCount > 0
      ? [
          {
            label: "見ただけでは決まらない所",
            count: countRoundCount,
            unit: "か所",
            durationMsPerUnit: BRIDGES_SPEED_PER_COUNT_ROUND_MS,
          } as const,
        ]
      : []),
    ...(connectivityRoundCount > 0
      ? [
          {
            label: "つながりを考える所",
            count: connectivityRoundCount,
            unit: "か所",
            durationMsPerUnit: BRIDGES_SPEED_PER_CONNECTIVITY_ROUND_MS,
          } as const,
        ]
      : []),
    ...(countReasoningUndecidedEdgeCount > 0
      ? [
          {
            label: "つながりで決める橋",
            count: countReasoningUndecidedEdgeCount,
            unit: "か所",
            durationMsPerUnit: BRIDGES_SPEED_PER_UNDECIDED_EDGE_MS,
          } as const,
        ]
      : []),
  ];
}

/** 基準時間の式の言葉の説明。式に出た項だけを説明する。 */
function listSpeedFormulaNotes({
  countRoundCount,
  connectivityRoundCount,
  countReasoningUndecidedEdgeCount,
}: BridgesWorkload): string[] {
  return [
    "式の数はこの問題の盤面で決まり、遊び方では変わらない。橋は2本の組を2本と数える。",
    ...(countRoundCount > 0
      ? [
          "見ただけでは決まらない所は、数字と架けられる相手の数を比べて「この島へは少なくとも1本架かる」と考えて進める所。",
        ]
      : []),
    ...(connectivityRoundCount > 0
      ? [
          "つながりを考える所は、数字だけでは進めず、架けると島の組が閉じて孤立しないかを考えて進める所。",
        ]
      : []),
    ...(countReasoningUndecidedEdgeCount > 0
      ? ["つながりで決める橋は、数字だけでは本数が決まらない、島と島の間の数。"]
      : []),
  ];
}

/** 速さだけで採点する。架け直し・待った・盤面を戻すは時間にだけ表れる。 */
export function getBridgesScoreCriteria(
  result: BridgesResult,
): GameResultScoreCriteria {
  return [
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: BRIDGES_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
        formula: listSpeedFormula(result.workload),
        notes: [
          ...listSpeedFormulaNotes(result.workload),
          "架け直しの回数は点に入らない。",
        ],
      }),
    ),
  ];
}
