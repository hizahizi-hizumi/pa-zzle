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

export const SHUTTLE_PARKING_SCORE_MODEL_VERSION = "1";

export const SHUTTLE_PARKING_SCORE_MAXIMUMS = {
  accuracy: 60,
  speed: 40,
} as const satisfies ScoreMaximums<"accuracy" | "speed">;

/** 罠に入った出庫1回ごとの減点。罠の結果が何人先に出るかによらず同じ。 */
export const SHUTTLE_PARKING_TRAP_PENALTY = 20;

export const SHUTTLE_PARKING_SPEED_BOARD_READING_MS = 5_000;
export const SHUTTLE_PARKING_SPEED_PER_CAR_MS = 3_000;
export const SHUTTLE_PARKING_SPEED_PER_PASSENGER_MS = 1_000;
/** 速さが0点になる時間の、基準時間に対する倍率。 */
export const SHUTTLE_PARKING_SPEED_ZERO_SCORE_RATIO = 2;

export type ShuttleParkingSpeedReference = {
  carCount: number;
  passengerCount: number;
};

export type ShuttleParkingPlayScore = PlayScore<
  keyof typeof SHUTTLE_PARKING_SCORE_MAXIMUMS
>;

type ShuttleParkingTimeDeltaInput = {
  elapsedMs: number;
  speedReference: ShuttleParkingSpeedReference;
};

export type ShuttleParkingPlayScoreInput = ShuttleParkingTimeDeltaInput & {
  trapCount: number;
};

export function calculateShuttleParkingSpeedFullScoreMs({
  carCount,
  passengerCount,
}: ShuttleParkingSpeedReference): number {
  return (
    SHUTTLE_PARKING_SPEED_BOARD_READING_MS +
    Math.max(0, carCount) * SHUTTLE_PARKING_SPEED_PER_CAR_MS +
    Math.max(0, passengerCount) * SHUTTLE_PARKING_SPEED_PER_PASSENGER_MS
  );
}

export function calculateShuttleParkingSpeedScoreRule(
  speedReference: ShuttleParkingSpeedReference,
): SpeedScoreRule {
  return createSpeedScoreRule(
    calculateShuttleParkingSpeedFullScoreMs(speedReference),
    SHUTTLE_PARKING_SPEED_ZERO_SCORE_RATIO,
  );
}

export function calculateShuttleParkingTimeDeltaMs({
  elapsedMs,
  speedReference,
}: ShuttleParkingTimeDeltaInput): number {
  return calculateTimeDeltaMs(
    elapsedMs,
    calculateShuttleParkingSpeedScoreRule(speedReference),
  );
}

export function calculateShuttleParkingPlayScore({
  speedReference,
  elapsedMs,
  trapCount,
}: ShuttleParkingPlayScoreInput): ShuttleParkingPlayScore {
  const accuracy = subtractWithFloor(
    SHUTTLE_PARKING_SCORE_MAXIMUMS.accuracy,
    trapCount * SHUTTLE_PARKING_TRAP_PENALTY,
  );
  const speed = calculateSpeedScore(
    SHUTTLE_PARKING_SCORE_MAXIMUMS.speed,
    elapsedMs,
    calculateShuttleParkingSpeedScoreRule(speedReference),
  );
  return sumPlayScore({ accuracy, speed });
}
