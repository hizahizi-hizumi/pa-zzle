import type { LegacyParkingJamDifficulty } from "@/games/parking-jam/difficulty";

export const PARKING_JAM_SCORE_MODEL_VERSION = "play-quality-v2";

export const PARKING_JAM_SCORE_MAXIMUMS = {
  accuracy: 40,
  speed: 40,
  stability: 20,
} as const;

export const PARKING_JAM_FAILED_MOVE_PENALTY = 5;
export const PARKING_JAM_UNDO_PENALTY = 2;
export const PARKING_JAM_RESTART_PENALTY = 5;

export const PARKING_JAM_SPEED_BOARD_READING_MS = 5_000;
export const PARKING_JAM_SPEED_PER_VEHICLE_MS = 3_000;
export const PARKING_JAM_SPEED_PER_INITIALLY_BLOCKED_VEHICLE_MS = 3_000;

// play-quality-v1 は8×8・14台固定の問題に対して難易度ごとの基準時間を使っていた。
// v1 時代の記録を当時の意味で再計算するためだけに残す。
export const PARKING_JAM_LEGACY_SPEED_FULL_SCORE_MS: Record<
  LegacyParkingJamDifficulty,
  number
> = {
  easy: 60_000,
  normal: 90_000,
  hard: 120_000,
};

export type ParkingJamSpeedReference = {
  vehicleCount: number;
  initialBlockedVehicleCount: number;
};

export type ParkingJamPlayScore = {
  total: number;
  breakdown: {
    accuracy: number;
    speed: number;
    stability: number;
  };
};

export type ParkingJamPlayScoreInput = {
  speedFullScoreMs: number;
  elapsedMs: number;
  failedMoveCount: number;
  undoCount: number;
  restartCount: number;
};

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function calculateLinearScore(maximum: number, ratio: number): number {
  return Math.round(maximum * clampUnit(ratio));
}

function subtractWithFloor(maximum: number, penalty: number): number {
  return Math.max(0, maximum - penalty);
}

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

export function calculateParkingJamPlayScore({
  speedFullScoreMs,
  elapsedMs,
  failedMoveCount,
  undoCount,
  restartCount,
}: ParkingJamPlayScoreInput): ParkingJamPlayScore {
  const accuracy = subtractWithFloor(
    PARKING_JAM_SCORE_MAXIMUMS.accuracy,
    failedMoveCount * PARKING_JAM_FAILED_MOVE_PENALTY,
  );

  const overtimeMs = Math.max(0, elapsedMs - speedFullScoreMs);
  const speed = calculateLinearScore(
    PARKING_JAM_SCORE_MAXIMUMS.speed,
    1 - overtimeMs / speedFullScoreMs,
  );

  const stability = subtractWithFloor(
    PARKING_JAM_SCORE_MAXIMUMS.stability,
    undoCount * PARKING_JAM_UNDO_PENALTY +
      restartCount * PARKING_JAM_RESTART_PENALTY,
  );

  return {
    total: accuracy + speed + stability,
    breakdown: { accuracy, speed, stability },
  };
}
