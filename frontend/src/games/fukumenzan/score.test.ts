import {
  calculateFukumenzanPlayScore,
  calculateFukumenzanSpeedScoreRule,
  calculateFukumenzanTimeDeltaMs,
} from "@/games/fukumenzan/score";

// 基準時間は 20 + 5×15 + 10×1 = 105秒、0点は3倍の 315秒。
const workload = { letterCount: 5, letterCellCount: 10 };

describe("calculateFukumenzanSpeedScoreRule", () => {
  test("文字の種類と式の文字の数から基準時間を決め、その3倍を0点にすること", () => {
    const rule = calculateFukumenzanSpeedScoreRule(workload);

    expect(rule).toEqual({ fullScoreMs: 105_000, zeroScoreMs: 315_000 });
  });
});

describe("calculateFukumenzanPlayScore", () => {
  test.each([
    [105_000, 100],
    // 超えた 21秒は、満点から0点までの 210秒の 1割。
    [126_000, 90],
    [315_000, 0],
  ])("%d ミリ秒で解くと %d 点にすること", (elapsedMs, expected) => {
    const score = calculateFukumenzanPlayScore({ elapsedMs, workload });

    expect(score).toEqual({ total: expected, breakdown: { speed: expected } });
  });
});

describe("calculateFukumenzanTimeDeltaMs", () => {
  test("基準時間との差を返すこと", () => {
    const delta = calculateFukumenzanTimeDeltaMs({
      elapsedMs: 100_000,
      workload,
    });

    expect(delta).toBe(-5_000);
  });
});
