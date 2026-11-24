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

export const SHUTTLE_PARKING_SCORE_MODEL_VERSION = "3";

export const SHUTTLE_PARKING_SCORE_MAXIMUMS = {
  accuracy: 60,
  speed: 40,
} as const satisfies ScoreMaximums<"accuracy" | "speed">;

/**
 * 罠に入った出庫1回ごとの減点。罠の結果が何人先に出るかによらず同じ。1回入ると最高でも80点（`good`）になり、
 * `great`・`perfect` は罠に入らずに読み切ったプレイだけに残る。
 */
export const SHUTTLE_PARKING_TRAP_PENALTY = 20;

/** 盤面と列を見渡す時間。 */
export const SHUTTLE_PARKING_SPEED_BOARD_READING_MS = 5_000;
/** 車1台を選んで出す時間。車はどの問題も1台ずつ1回出す。 */
export const SHUTTLE_PARKING_SPEED_PER_CAR_MS = 2_000;
/** 列の1人を目で追う時間。 */
export const SHUTTLE_PARKING_SPEED_PER_PASSENGER_MS = 500;
/** 罠を避けるために先まで読む1人あたりの時間。レベルを決める罠の重さ（何人先に結果が出るか）に掛ける。 */
export const SHUTTLE_PARKING_SPEED_PER_TRAP_WEIGHT_MS = 2_000;
/** 読む人数の項に数える重さの上限。最も重い問題でも、この項が基準時間の半分を超えないようにする。 */
export const SHUTTLE_PARKING_SPEED_TRAP_WEIGHT_LIMIT = 14;
/** 速さが0点になる時間の、基準時間に対する倍率。 */
export const SHUTTLE_PARKING_SPEED_ZERO_SCORE_RATIO = 2;

/**
 * 基準時間に使う問題の事実。`trapWeight` はどう進めても出会う最も重い罠の重さ（その罠の結果が何人先に出るか。Lv1 は0）で、
 * 読む量を表す。台数と列の人数はどのレベルでもほぼ同じなので、読む量を足さないと上のレベルほど速さの点が下がる。
 */
export type ShuttleParkingSpeedReference = {
  carCount: number;
  passengerCount: number;
  trapWeight: number;
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
  trapWeight,
}: ShuttleParkingSpeedReference): number {
  const totalMs =
    SHUTTLE_PARKING_SPEED_BOARD_READING_MS +
    Math.max(0, carCount) * SHUTTLE_PARKING_SPEED_PER_CAR_MS +
    Math.max(0, passengerCount) * SHUTTLE_PARKING_SPEED_PER_PASSENGER_MS +
    countShuttleParkingSpeedTrapWeight(trapWeight) *
      SHUTTLE_PARKING_SPEED_PER_TRAP_WEIGHT_MS;
  // 結果は秒の単位で見せるので、基準時間も秒に切り上げる（0.5秒の端数で「基準差 -00:00」と出さない）。
  return Math.ceil(totalMs / 1_000) * 1_000;
}

/** 基準時間の読む人数の項に数える重さ。 */
export function countShuttleParkingSpeedTrapWeight(trapWeight: number): number {
  return Math.min(
    Math.max(0, trapWeight),
    SHUTTLE_PARKING_SPEED_TRAP_WEIGHT_LIMIT,
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
