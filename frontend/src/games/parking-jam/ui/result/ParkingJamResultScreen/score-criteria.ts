import type { GameResultScoreCriteria } from "@/components/GameResultScreen";
import {
  createOperationPenalty,
  createScoreItemCriterion,
  describePenaltyScoreCriterion,
  describeSpeedScoreCriterion,
} from "@/components/game-result-score-criteria";
import type { ParkingJamResult } from "@/games/parking-jam/play/use-parking-jam-play";
import {
  PARKING_JAM_FAILED_MOVE_PENALTY,
  PARKING_JAM_RESTART_PENALTY,
  PARKING_JAM_SCORE_MAXIMUMS,
  PARKING_JAM_SPEED_BOARD_READING_MS,
  PARKING_JAM_SPEED_PER_INITIALLY_BLOCKED_VEHICLE_MS,
  PARKING_JAM_SPEED_PER_VEHICLE_MS,
  PARKING_JAM_UNDO_PENALTY,
} from "@/games/parking-jam/score";

export function getParkingJamScoreCriteria(
  result: ParkingJamResult,
): GameResultScoreCriteria {
  return [
    createScoreItemCriterion(
      "accuracy",
      describePenaltyScoreCriterion(PARKING_JAM_SCORE_MAXIMUMS.accuracy, [
        {
          subject: "出せない方向への操作",
          unit: "回",
          points: PARKING_JAM_FAILED_MOVE_PENALTY,
        },
      ]),
    ),
    createScoreItemCriterion(
      "speed",
      describeSpeedScoreCriterion({
        maximum: PARKING_JAM_SCORE_MAXIMUMS.speed,
        rule: result.speedRule,
        formula: [
          { label: "盤面把握", durationMs: PARKING_JAM_SPEED_BOARD_READING_MS },
          {
            label: "車",
            count: result.speedReference.vehicleCount,
            unit: "台",
            durationMsPerUnit: PARKING_JAM_SPEED_PER_VEHICLE_MS,
          },
          {
            label: "初めに塞がれた車",
            count: result.speedReference.initialBlockedVehicleCount,
            unit: "台",
            durationMsPerUnit:
              PARKING_JAM_SPEED_PER_INITIALLY_BLOCKED_VEHICLE_MS,
          },
        ],
      }),
    ),
    createScoreItemCriterion(
      "stability",
      describePenaltyScoreCriterion(PARKING_JAM_SCORE_MAXIMUMS.stability, [
        createOperationPenalty("undo", PARKING_JAM_UNDO_PENALTY),
        createOperationPenalty("restart", PARKING_JAM_RESTART_PENALTY),
      ]),
    ),
  ];
}
