import {
  calculateIceFloorMazeMoveDelta,
  calculateIceFloorMazePlayScore,
  calculateIceFloorMazeSpeedFullScoreMs,
  calculateIceFloorMazeSpeedScoreRule,
  calculateIceFloorMazeTimeDeltaMs,
  ICE_FLOOR_MAZE_SCORE_MAXIMUMS,
} from "@/games/ice-floor-maze/score";

// 10×13 で最短6手（レベル4 の中央値）の問題。基準時間は 130マス × 0.2秒 + 6手 × 2.5秒 = 41秒。
const boardShape = { width: 10, height: 13 };
const optimalMoveCount = 6;
const speedFullScoreMs = 41_000;

describe("calculateIceFloorMazeSpeedFullScoreMs", () => {
  test("盤面のマス数と最短手数から基準時間を算出すること", () => {
    const result = calculateIceFloorMazeSpeedFullScoreMs({
      boardShape,
      optimalMoveCount,
    });

    expect(result).toBe(speedFullScoreMs);
  });

  const cases = [
    [8, 8, 3, 20_300],
    [12, 14, 6, 48_600],
    [12, 14, 7, 51_100],
  ] as const;

  test.each(cases)(
    "%i×%i・最短 %i 手の問題では基準時間を %i ミリ秒にすること",
    (width, height, sizedOptimalMoveCount, expected) => {
      const result = calculateIceFloorMazeSpeedFullScoreMs({
        boardShape: { width, height },
        optimalMoveCount: sizedOptimalMoveCount,
      });

      expect(result).toBe(expected);
    },
  );
});

describe("calculateIceFloorMazeSpeedScoreRule", () => {
  test("基準時間の2倍で0点になる規則を返すこと", () => {
    const rule = calculateIceFloorMazeSpeedScoreRule({
      boardShape,
      optimalMoveCount,
    });

    expect(rule).toEqual({
      fullScoreMs: speedFullScoreMs,
      zeroScoreMs: speedFullScoreMs * 2,
    });
  });
});

describe("calculateIceFloorMazeTimeDeltaMs", () => {
  test("経過時間と基準時間との差を算出すること", () => {
    const result = calculateIceFloorMazeTimeDeltaMs({
      elapsedMs: 36_000,
      boardShape,
      optimalMoveCount,
    });

    expect(result).toBe(-5_000);
  });
});

describe("calculateIceFloorMazeMoveDelta", () => {
  test("待ったで取り消した手も含む総手数と最短手数との差を算出すること", () => {
    const result = calculateIceFloorMazeMoveDelta({
      moveCount: 9,
      optimalMoveCount,
    });

    expect(result).toBe(3);
  });
});

describe("calculateIceFloorMazePlayScore", () => {
  test("最短手数を基準時間内で解くと100点になること", () => {
    const score = calculateIceFloorMazePlayScore({
      elapsedMs: speedFullScoreMs,
      moveCount: optimalMoveCount,
      boardShape,
      optimalMoveCount,
    });

    expect(score).toEqual({
      total: 100,
      breakdown: {
        efficiency: ICE_FLOOR_MAZE_SCORE_MAXIMUMS.efficiency,
        speed: ICE_FLOOR_MAZE_SCORE_MAXIMUMS.speed,
      },
    });
  });

  test.each([
    [6, 60],
    [7, 51],
    [9, 40],
    [12, 30],
    [18, 20],
  ])(
    "総手数 %i 手では効率を最短手数との比で %i 点にすること",
    (moveCount, expected) => {
      const score = calculateIceFloorMazePlayScore({
        elapsedMs: speedFullScoreMs,
        moveCount,
        boardShape,
        optimalMoveCount,
      });

      expect(score.breakdown.efficiency).toBe(expected);
    },
  );

  test.each([
    [41_000, 40],
    [51_250, 30],
    [61_500, 20],
    [82_000, 0],
    [120_000, 0],
  ])(
    "経過時間 %i ミリ秒では速さを基準時間の超過に応じて %i 点にすること",
    (elapsedMs, expected) => {
      const score = calculateIceFloorMazePlayScore({
        elapsedMs,
        moveCount: optimalMoveCount,
        boardShape,
        optimalMoveCount,
      });

      expect(score.breakdown.speed).toBe(expected);
    },
  );

  test("各評価軸を1点単位へ四捨五入して合計すること", () => {
    const score = calculateIceFloorMazePlayScore({
      elapsedMs: 51_000,
      moveCount: 9,
      boardShape,
      optimalMoveCount,
    });

    expect(score).toEqual({
      total: 70,
      breakdown: { efficiency: 40, speed: 30 },
    });
  });

  test("同じ倍率の時間と手数なら、盤面の広さや最短手数が違っても同じ点になること", () => {
    const narrow = calculateIceFloorMazePlayScore({
      elapsedMs: 20_300 * 1.2,
      moveCount: 4,
      boardShape: { width: 8, height: 8 },
      optimalMoveCount: 3,
    });
    const wide = calculateIceFloorMazePlayScore({
      elapsedMs: 51_100 * 1.2,
      moveCount: 9,
      boardShape: { width: 12, height: 14 },
      optimalMoveCount: 7,
    });

    expect(narrow.breakdown.speed).toBe(wide.breakdown.speed);
  });

  describe("代表的なプレイ例", () => {
    const plays = [
      { name: "最短手数で速く解いたプレイ", moveCount: 6, elapsedMs: 30_000 },
      {
        name: "最短手数だが基準を少し超えたプレイ",
        moveCount: 6,
        elapsedMs: 50_000,
      },
      {
        name: "1手試し滑りして待ったで戻し、速く解いたプレイ",
        moveCount: 7,
        elapsedMs: 35_000,
      },
      {
        name: "最短手数だが基準の1.5倍の時間がかかったプレイ",
        moveCount: 6,
        elapsedMs: 61_500,
      },
      {
        name: "閉じ込められて盤面を戻し、解き直したプレイ",
        moveCount: 10,
        elapsedMs: 45_000,
      },
      {
        name: "最短の2倍の手数を試し滑りして速く解いたプレイ",
        moveCount: 12,
        elapsedMs: 41_000,
      },
      {
        name: "最短の3倍の手数を試し滑りして遅く解いたプレイ",
        moveCount: 18,
        elapsedMs: 90_000,
      },
    ];
    const expectedOrder = plays.map((play) => play.name);

    test("良いプレイほど高い評価になる順序を保つこと", () => {
      const ranked = plays
        .map((play) => ({
          name: play.name,
          total: calculateIceFloorMazePlayScore({
            ...play,
            boardShape,
            optimalMoveCount,
          }).total,
        }))
        .sort((left, right) => right.total - left.total)
        .map((play) => play.name);

      expect(ranked).toEqual(expectedOrder);
    });
  });
});
