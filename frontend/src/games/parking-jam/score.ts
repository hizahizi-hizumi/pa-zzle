import type { GameResultLevel } from "@/games/result";
import type { ParkingJamDifficulty } from "./difficulty";

export const PARKING_JAM_SCORE_MODEL_VERSION = "play-quality-v1";

export const PARKING_JAM_SCORE_MAXIMUMS = {
  accuracy: 40,
  speed: 40,
  stability: 20,
} as const;

export const PARKING_JAM_FAILED_MOVE_PENALTY = 5;
export const PARKING_JAM_UNDO_PENALTY = 2;
export const PARKING_JAM_RESTART_PENALTY = 5;

export const PARKING_JAM_SPEED_FULL_SCORE_MS: Record<
  ParkingJamDifficulty,
  number
> = {
  easy: 60_000,
  normal: 90_000,
  hard: 120_000,
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
  difficulty: ParkingJamDifficulty;
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

export function calculateParkingJamPlayScore({
  difficulty,
  elapsedMs,
  failedMoveCount,
  undoCount,
  restartCount,
}: ParkingJamPlayScoreInput): ParkingJamPlayScore {
  const accuracy = subtractWithFloor(
    PARKING_JAM_SCORE_MAXIMUMS.accuracy,
    failedMoveCount * PARKING_JAM_FAILED_MOVE_PENALTY,
  );

  const speedFullScoreMs = PARKING_JAM_SPEED_FULL_SCORE_MS[difficulty];
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

export function getParkingJamGameResultLevel(score: number): GameResultLevel {
  if (score >= 100) return "perfect";
  if (score >= 90) return "great";
  if (score >= 80) return "good";
  return "clear";
}
