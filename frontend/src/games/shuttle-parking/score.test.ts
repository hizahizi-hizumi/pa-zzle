import {
  calculateShuttleParkingPlayScore,
  calculateShuttleParkingSpeedFullScoreMs,
  calculateShuttleParkingTimeDeltaMs,
  SHUTTLE_PARKING_SCORE_MAXIMUMS,
} from "@/games/shuttle-parking/score";

const speedReference = { carCount: 8, passengerCount: 20 };

describe("calculateShuttleParkingSpeedFullScoreMs", () => {
  test("盤面把握に車と乗客の数に応じた時間を足すこと", () => {
    const fullScoreMs = calculateShuttleParkingSpeedFullScoreMs(speedReference);

    expect(fullScoreMs).toBe(5_000 + 8 * 3_000 + 20 * 1_000);
  });
});

describe("calculateShuttleParkingPlayScore", () => {
  test("罠に入らず基準時間内に解くと満点になること", () => {
    const score = calculateShuttleParkingPlayScore({
      speedReference,
      elapsedMs: 30_000,
      trapCount: 0,
    });

    expect(score.total).toBe(100);
  });

  test("罠に入った回数ごとに正確さを減らし、0点より下げないこと", () => {
    const scores = [1, 2, 5].map(
      (trapCount) =>
        calculateShuttleParkingPlayScore({
          speedReference,
          elapsedMs: 30_000,
          trapCount,
        }).breakdown.accuracy,
    );

    expect(scores).toEqual([40, 20, 0]);
  });

  test("基準時間の2倍で速さが0点になること", () => {
    const score = calculateShuttleParkingPlayScore({
      speedReference,
      elapsedMs: 2 * calculateShuttleParkingSpeedFullScoreMs(speedReference),
      trapCount: 0,
    });

    expect(score.breakdown.speed).toBe(0);
    expect(score.total).toBe(SHUTTLE_PARKING_SCORE_MAXIMUMS.accuracy);
  });
});

describe("calculateShuttleParkingTimeDeltaMs", () => {
  test("基準時間との差を返すこと", () => {
    const delta = calculateShuttleParkingTimeDeltaMs({
      speedReference,
      elapsedMs: 60_000,
    });

    expect(delta).toBe(60_000 - 49_000);
  });
});
