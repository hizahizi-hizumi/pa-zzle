import { getGameResultLevel } from "@/games/result";
import {
  calculateShuttleParkingPlayScore,
  calculateShuttleParkingSpeedFullScoreMs,
  calculateShuttleParkingTimeDeltaMs,
  SHUTTLE_PARKING_SCORE_MAXIMUMS,
  SHUTTLE_PARKING_SPEED_TRAP_WEIGHT_LIMIT,
} from "@/games/shuttle-parking/score";

// レベル3の中ほどの問題: 車8台・列20人・罠の結果が6人先に出る。基準時間は 5 + 8×2 + 20×0.5 + 6×2 = 43秒。
const speedReference = { carCount: 8, passengerCount: 20, trapWeight: 6 };

describe("calculateShuttleParkingSpeedFullScoreMs", () => {
  test("盤面把握に、車・列の人数・罠の重さに応じた時間を足すこと", () => {
    const fullScoreMs = calculateShuttleParkingSpeedFullScoreMs(speedReference);

    expect(fullScoreMs).toBe(5_000 + 8 * 2_000 + 20 * 500 + 6 * 2_000);
  });

  test("罠の結果が先に出る問題ほど、読む時間を長く取ること", () => {
    const [level1, level5] = [0, 12].map((trapWeight) =>
      calculateShuttleParkingSpeedFullScoreMs({
        ...speedReference,
        trapWeight,
      }),
    );

    expect(level5! - level1!).toBe(24_000);
  });
});

describe("calculateShuttleParkingSpeedFullScoreMs の端と上限", () => {
  test("基準時間を秒に切り上げること", () => {
    const fullScoreMs = calculateShuttleParkingSpeedFullScoreMs({
      ...speedReference,
      passengerCount: 21,
    });

    expect(fullScoreMs).toBe(44_000);
  });

  test("先読みの人数は上限までを数え、その項が基準時間の半分を超えないこと", () => {
    const heaviest = { carCount: 8, passengerCount: 16, trapWeight: 17 };

    const fullScoreMs = calculateShuttleParkingSpeedFullScoreMs(heaviest);
    const trapTermMs = SHUTTLE_PARKING_SPEED_TRAP_WEIGHT_LIMIT * 2_000;

    expect(fullScoreMs).toBe(5_000 + 16_000 + 8_000 + trapTermMs);
    expect(trapTermMs / fullScoreMs).toBeLessThan(0.5);
  });
});

describe("calculateShuttleParkingPlayScore", () => {
  test("罠に入らず基準時間内に解くと満点になること", () => {
    const score = calculateShuttleParkingPlayScore({
      speedReference,
      elapsedMs: 40_000,
      trapCount: 0,
    });

    expect(score.total).toBe(100);
  });

  test("罠に入った回数ごとに正確さを減らし、0点より下げないこと", () => {
    const scores = [1, 2, 5].map(
      (trapCount) =>
        calculateShuttleParkingPlayScore({
          speedReference,
          elapsedMs: 40_000,
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

  describe("解き方の代表例の場合", () => {
    // 押し間違いは罠でない車を出して待ったで戻したもので、罠に数えない。戻した分だけ時間がかかる。
    const plays = {
      readThrough: { elapsedMs: 40_000, trapCount: 0 },
      undoSlip: { elapsedMs: 46_000, trapCount: 0 },
      oneTrap: { elapsedMs: 40_000, trapCount: 1 },
      trialAndBacktrack: { elapsedMs: 70_000, trapCount: 2 },
    };
    const totals = Object.fromEntries(
      Object.entries(plays).map(([name, play]) => [
        name,
        calculateShuttleParkingPlayScore({ speedReference, ...play }).total,
      ]),
    ) as Record<keyof typeof plays, number>;

    test("読み切って罠に入らないプレイを最も高く評価すること", () => {
      expect(getGameResultLevel(totals.readThrough)).toBe("perfect");
    });

    test("押し間違いを待ったで戻しても、罠に入らなければ great に残ること", () => {
      expect(getGameResultLevel(totals.undoSlip)).toBe("great");
    });

    test("罠に1回入ると、基準時間内に解いても great に届かないこと", () => {
      expect(getGameResultLevel(totals.oneTrap)).toBe("good");
    });

    test("試して戻して解くプレイを、読み切るプレイより大きく下げること", () => {
      expect(totals.trialAndBacktrack).toBeLessThan(totals.oneTrap);
      expect(getGameResultLevel(totals.trialAndBacktrack)).toBe("clear");
    });
  });
});

describe("calculateShuttleParkingTimeDeltaMs", () => {
  test("基準時間との差を返すこと", () => {
    const delta = calculateShuttleParkingTimeDeltaMs({
      speedReference,
      elapsedMs: 60_000,
    });

    expect(delta).toBe(60_000 - 43_000);
  });
});
