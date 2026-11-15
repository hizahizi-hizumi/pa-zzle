import {
  calculateSpeedScore,
  calculateTimeDeltaMs,
  createSpeedScoreRule,
  type PlayScore,
  type ScoreMaximums,
  type SpeedScoreRule,
  subtractWithFloor,
  sumPlayScore,
} from "@/games/score";

export const PARKING_JAM_SCORE_MODEL_VERSION = "play-quality-v3";

export const PARKING_JAM_SCORE_MAXIMUMS = {
  accuracy: 60,
  speed: 40,
} as const satisfies ScoreMaximums<"accuracy" | "speed">;

export const PARKING_JAM_FAILED_MOVE_PENALTY = 10;

export const PARKING_JAM_SPEED_BOARD_READING_MS = 5_000;
export const PARKING_JAM_SPEED_PER_VEHICLE_MS = 3_000;
export const PARKING_JAM_SPEED_PER_INITIALLY_BLOCKED_VEHICLE_MS = 3_000;
/** 速さが0点になる時間の、基準時間に対する倍率。 */
export const PARKING_JAM_SPEED_ZERO_SCORE_RATIO = 2;

export type ParkingJamSpeedReference = {
  vehicleCount: number;
  initialBlockedVehicleCount: number;
};

export type ParkingJamPlayScore = PlayScore<
  keyof typeof PARKING_JAM_SCORE_MAXIMUMS
>;

type ParkingJamTimeDeltaInput = {
  elapsedMs: number;
  speedReference: ParkingJamSpeedReference;
};

export type ParkingJamPlayScoreInput = ParkingJamTimeDeltaInput & {
  failedMoveCount: number;
};

export function calculateParkingJamSpeedFullScoreMs({
  vehicleCount,
  initialBlockedVehicleCount,
}: ParkingJamSpeedReference): number {
  return (
    PARKING_JAM_SPEED_BOARD_READING_MS +
    Math.max(0, vehicleCount) * PARKING_JAM_SPEED_PER_VEHICLE_MS +
    Math.max(0, initialBlockedVehicleCount) *
      PARKING_JAM_SPEED_PER_INITIALLY_BLOCKED_VEHICLE_MS
  );
}

export function calculateParkingJamSpeedScoreRule(
  speedReference: ParkingJamSpeedReference,
): SpeedScoreRule {
  return createSpeedScoreRule(
    calculateParkingJamSpeedFullScoreMs(speedReference),
    PARKING_JAM_SPEED_ZERO_SCORE_RATIO,
  );
}

export function calculateParkingJamTimeDeltaMs({
  elapsedMs,
  speedReference,
}: ParkingJamTimeDeltaInput): number {
  return calculateTimeDeltaMs(
    elapsedMs,
    calculateParkingJamSpeedScoreRule(speedReference),
  );
}

export function calculateParkingJamPlayScore({
  speedReference,
  elapsedMs,
  failedMoveCount,
}: ParkingJamPlayScoreInput): ParkingJamPlayScore {
  const accuracy = subtractWithFloor(
    PARKING_JAM_SCORE_MAXIMUMS.accuracy,
    failedMoveCount * PARKING_JAM_FAILED_MOVE_PENALTY,
  );

  const speed = calculateSpeedScore(
    PARKING_JAM_SCORE_MAXIMUMS.speed,
    elapsedMs,
    calculateParkingJamSpeedScoreRule(speedReference),
  );

  return sumPlayScore({ accuracy, speed });
}
