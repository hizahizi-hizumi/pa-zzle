import {
  _private,
  calculateSlidePuzzleMoveDelta,
  calculateSlidePuzzlePerformanceComparison,
  calculateSlidePuzzlePlayScore,
  calculateSlidePuzzleTimeDeltaMs,
  getSlidePuzzleGameResultLevel,
  SLIDE_PUZZLE_SCORE_MAXIMUMS,
} from "@/games/slide-puzzle/score";

const { calculateSlidePuzzleSpeedFullScoreMs } = _private;

// 4×4 で最短 30 手（レベル 3 の中央値）の問題。基準時間は 10 秒 + 30 手 × 2 秒 = 70 秒。
const boardSize = 4;
const optimalMoveCount = 30;
const speedFullScoreMs = 70_000;

describe("calculateSlidePuzzleSpeedFullScoreMs", () => {
  test("盤面把握の時間と最短手数から基準時間を算出すること", () => {
    const result = calculateSlidePuzzleSpeedFullScoreMs({
      boardSize,
      optimalMoveCount,
    });

    expect(result).toBe(speedFullScoreMs);
  });

  const cases = [
    [3, 20, 45_000],
    [4, 20, 50_000],
    [5, 20, 55_000],
  ] as const;

  test.each(cases)(
    "一辺 %i・最短 %i 手の問題では盤面把握の時間を盤面サイズで変えて %i ミリ秒にすること",
    (sizedBoardSize, sizedOptimalMoveCount, expected) => {
      const result = calculateSlidePuzzleSpeedFullScoreMs({
        boardSize: sizedBoardSize,
        optimalMoveCount: sizedOptimalMoveCount,
      });

      expect(result).toBe(expected);
    },
  );
});

describe("calculateSlidePuzzleTimeDeltaMs", () => {
  test("経過時間と基準時間との差を算出すること", () => {
    const result = calculateSlidePuzzleTimeDeltaMs({
      elapsedMs: 65_000,
      boardSize,
      optimalMoveCount,
    });

    expect(result).toBe(-5_000);
  });
});

describe("calculateSlidePuzzleMoveDelta", () => {
  test("盤面を戻す前も含む総手数と最短手数との差を算出すること", () => {
    const result = calculateSlidePuzzleMoveDelta({
      moveCount: 42,
      optimalMoveCount,
    });

    expect(result).toBe(12);
  });
});

describe("calculateSlidePuzzlePerformanceComparison", () => {
  test("結果と記録で共有する比較指標をまとめて算出すること", () => {
    const result = calculateSlidePuzzlePerformanceComparison({
      elapsedMs: 80_000,
      moveCount: 42,
      boardSize,
      optimalMoveCount,
    });

    expect(result).toEqual({
      speedFullScoreMs,
      timeDeltaMs: 10_000,
      moveDelta: 12,
    });
  });
});

describe("calculateSlidePuzzlePlayScore", () => {
  test("最短手数を基準時間内で解くと100点になること", () => {
    const score = calculateSlidePuzzlePlayScore({
      elapsedMs: speedFullScoreMs,
      moveCount: optimalMoveCount,
      boardSize,
      optimalMoveCount,
    });

    expect(score).toEqual({
      total: 100,
      breakdown: {
        efficiency: SLIDE_PUZZLE_SCORE_MAXIMUMS.efficiency,
        speed: SLIDE_PUZZLE_SCORE_MAXIMUMS.speed,
      },
    });
  });

  test.each([
    [30, 60],
    [36, 50],
    [45, 40],
    [60, 30],
    [90, 20],
  ])(
    "総手数 %i 手では効率を最短手数との比で %i 点にすること",
    (moveCount, expected) => {
      const score = calculateSlidePuzzlePlayScore({
        elapsedMs: speedFullScoreMs,
        moveCount,
        boardSize,
        optimalMoveCount,
      });

      expect(score.breakdown.efficiency).toBe(expected);
    },
  );

  test.each([
    [70_000, 40],
    [87_500, 30],
    [105_000, 20],
    [140_000, 0],
    [200_000, 0],
  ])(
    "経過時間 %i ミリ秒では速さを基準時間の超過に応じて %i 点にすること",
    (elapsedMs, expected) => {
      const score = calculateSlidePuzzlePlayScore({
        elapsedMs,
        moveCount: optimalMoveCount,
        boardSize,
        optimalMoveCount,
      });

      expect(score.breakdown.speed).toBe(expected);
    },
  );

  test("各評価軸を1点単位へ四捨五入して合計すること", () => {
    const score = calculateSlidePuzzlePlayScore({
      elapsedMs: 80_000,
      moveCount: 42,
      boardSize,
      optimalMoveCount,
    });

    expect(score).toEqual({
      total: 77,
      breakdown: { efficiency: 43, speed: 34 },
    });
  });

  describe("代表的なプレイ例", () => {
    const plays = [
      { name: "最短手数で速く解いたプレイ", moveCount: 30, elapsedMs: 60_000 },
      {
        name: "少し遠回りして速く解いたプレイ",
        moveCount: 36,
        elapsedMs: 65_000,
      },
      {
        name: "最短手数だが基準の1.5倍の時間がかかったプレイ",
        moveCount: 30,
        elapsedMs: 105_000,
      },
      {
        name: "盤面を戻して最短手順で解き直したプレイ",
        moveCount: 50,
        elapsedMs: 75_000,
      },
      {
        name: "最短の2倍の手数で速く解いたプレイ",
        moveCount: 60,
        elapsedMs: 70_000,
      },
      {
        name: "最短の3倍の手数で遅く解いたプレイ",
        moveCount: 90,
        elapsedMs: 150_000,
      },
    ];
    const expectedOrder = plays.map((play) => play.name);

    test("良いプレイほど高い評価になる順序を保つこと", () => {
      const ranked = plays
        .map((play) => ({
          name: play.name,
          total: calculateSlidePuzzlePlayScore({
            ...play,
            boardSize,
            optimalMoveCount,
          }).total,
        }))
        .sort((left, right) => right.total - left.total)
        .map((play) => play.name);

      expect(ranked).toEqual(expectedOrder);
    });
  });
});

describe("getSlidePuzzleGameResultLevel", () => {
  test.each([
    [100, "perfect"],
    [90, "great"],
    [80, "good"],
    [79, "clear"],
  ] as const)("評価点 %i を %s 段階として扱うこと", (score, expected) => {
    const level = getSlidePuzzleGameResultLevel(score);

    expect(level).toBe(expected);
  });
});
