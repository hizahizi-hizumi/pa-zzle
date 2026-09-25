import {
  calculateMinesweeperPlayScore,
  calculateMinesweeperSpeedFullScoreMs,
  calculateMinesweeperTimeDeltaMs,
  getMinesweeperGameResultLevel,
  MINESWEEPER_MISTAKE_PENALTY,
  MINESWEEPER_SCORE_MAXIMUMS,
} from "./score";

const workload = { minimumOpenCount: 10, mineCount: 10 };
const speedFullScoreMs = 65_000;

describe("calculateMinesweeperSpeedFullScoreMs", () => {
  test("盤面把握時間と開く操作の最小回数と地雷数から基準時間を算出すること", () => {
    const result = calculateMinesweeperSpeedFullScoreMs(workload);

    expect(result).toBe(speedFullScoreMs);
  });
});

describe("calculateMinesweeperTimeDeltaMs", () => {
  test("実時間と問題ごとの基準時間との差を算出すること", () => {
    const result = calculateMinesweeperTimeDeltaMs({
      ...workload,
      elapsedMs: 70_000,
    });

    expect(result).toBe(5_000);
  });
});

describe("calculateMinesweeperPlayScore", () => {
  test("ミスなしで基準時間内にクリアしたプレイを満点とすること", () => {
    const result = calculateMinesweeperPlayScore({
      ...workload,
      elapsedMs: speedFullScoreMs,
      mistakeCount: 0,
    });

    expect(result).toEqual({
      total: 100,
      breakdown: {
        accuracy: MINESWEEPER_SCORE_MAXIMUMS.accuracy,
        speed: MINESWEEPER_SCORE_MAXIMUMS.speed,
      },
    });
  });

  test.each([
    { ratio: 0.5, speed: 30 },
    { ratio: 1, speed: 30 },
    { ratio: 1.5, speed: 15 },
    { ratio: 2, speed: 0 },
    { ratio: 3, speed: 0 },
  ])(
    "基準時間の $ratio 倍では速さを $speed 点とすること",
    ({ ratio, speed }) => {
      const result = calculateMinesweeperPlayScore({
        ...workload,
        elapsedMs: speedFullScoreMs * ratio,
        mistakeCount: 0,
      });

      expect(result.breakdown.speed).toBe(speed);
    },
  );

  test.each([
    { mistakeCount: 0, accuracy: 70 },
    { mistakeCount: 1, accuracy: 35 },
    { mistakeCount: 2, accuracy: 0 },
    { mistakeCount: 5, accuracy: 0 },
  ])(
    "踏んだ地雷 $mistakeCount 個では正確性を $accuracy 点とすること",
    ({ mistakeCount, accuracy }) => {
      const result = calculateMinesweeperPlayScore({
        ...workload,
        elapsedMs: speedFullScoreMs,
        mistakeCount,
      });

      expect(result.breakdown.accuracy).toBe(accuracy);
    },
  );

  test("地雷を1つ踏むと速さの満点を上回って失うこと", () => {
    expect(MINESWEEPER_MISTAKE_PENALTY).toBeGreaterThan(
      MINESWEEPER_SCORE_MAXIMUMS.speed,
    );

    const fastWithMistake = calculateMinesweeperPlayScore({
      ...workload,
      elapsedMs: 1_000,
      mistakeCount: 1,
    });
    const slowWithoutMistake = calculateMinesweeperPlayScore({
      ...workload,
      elapsedMs: speedFullScoreMs * 10,
      mistakeCount: 0,
    });

    expect(fastWithMistake.total).toBeLessThan(slowWithoutMistake.total);
    expect(getMinesweeperGameResultLevel(fastWithMistake.total)).toBe("clear");
  });

  test("ミスが多く遅いプレイでも0点を下回らないこと", () => {
    const result = calculateMinesweeperPlayScore({
      ...workload,
      elapsedMs: speedFullScoreMs * 10,
      mistakeCount: 10,
    });

    expect(result).toEqual({ total: 0, breakdown: { accuracy: 0, speed: 0 } });
  });
});

describe("getMinesweeperGameResultLevel", () => {
  test.each([
    { score: 100, level: "perfect" },
    { score: 99, level: "great" },
    { score: 90, level: "great" },
    { score: 89, level: "good" },
    { score: 80, level: "good" },
    { score: 79, level: "clear" },
    { score: 0, level: "clear" },
  ])("$score 点を $level とすること", ({ score, level }) => {
    expect(getMinesweeperGameResultLevel(score)).toBe(level);
  });
});
