import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createScoreItemCriterion,
  describePenaltyScoreCriterion,
  describeSpeedScoreCriterion,
} from "@/components/game-result-score-criteria";
import type { ShuttleParkingResult } from "@/games/shuttle-parking/play/use-shuttle-parking-play";
import {
  countShuttleParkingSpeedTrapWeight,
  SHUTTLE_PARKING_SCORE_MAXIMUMS,
  SHUTTLE_PARKING_SPEED_BOARD_READING_MS,
  SHUTTLE_PARKING_SPEED_PER_CAR_MS,
  SHUTTLE_PARKING_SPEED_PER_PASSENGER_MS,
  SHUTTLE_PARKING_SPEED_PER_TRAP_WEIGHT_MS,
  SHUTTLE_PARKING_SPEED_TRAP_WEIGHT_LIMIT,
  SHUTTLE_PARKING_TRAP_PENALTY,
} from "@/games/shuttle-parking/score";

export function getShuttleParkingScoreCriteria(
  result: ShuttleParkingResult,
): GameResultScoreCriteria {
  return [
    createScoreItemCriterion(
      "accuracy",
      describePenaltyScoreCriterion(SHUTTLE_PARKING_SCORE_MAXIMUMS.accuracy, [
        {
          subject: "全員を送り出せなくなる車を出した",
          unit: "回",
          points: SHUTTLE_PARKING_TRAP_PENALTY,
        },
      ]),
    ),
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: SHUTTLE_PARKING_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
        formula: [
          {
            label: "盤面把握",
            durationMs: SHUTTLE_PARKING_SPEED_BOARD_READING_MS,
          },
          {
            label: "車",
            count: result.speedReference.carCount,
            unit: "台",
            durationMsPerUnit: SHUTTLE_PARKING_SPEED_PER_CAR_MS,
          },
          {
            label: "乗客",
            count: result.speedReference.passengerCount,
            unit: "人",
            durationMsPerUnit: SHUTTLE_PARKING_SPEED_PER_PASSENGER_MS,
          },
          // 罠の結果が何人先に出るか。レベル1の問題は罠が無いので項を出さない。
          ...(result.speedReference.trapWeight > 0
            ? [
                {
                  label: "先読み",
                  count: countShuttleParkingSpeedTrapWeight(
                    result.speedReference.trapWeight,
                  ),
                  unit: "人",
                  durationMsPerUnit: SHUTTLE_PARKING_SPEED_PER_TRAP_WEIGHT_MS,
                } as const,
              ]
            : []),
        ],
        notes: [
          ...(result.speedReference.trapWeight > 0
            ? [
                `先読みは${SHUTTLE_PARKING_SPEED_TRAP_WEIGHT_LIMIT}人までを数える。`,
              ]
            : []),
          "合計は秒に切り上げる。",
        ],
      }),
    ),
  ];
}
