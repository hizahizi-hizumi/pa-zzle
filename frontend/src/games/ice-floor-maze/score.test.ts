import {
  calculateIceFloorMazeMoveDelta,
  calculateIceFloorMazePlayScore,
  calculateIceFloorMazeSpeedFullScoreMs,
  calculateIceFloorMazeSpeedScoreRule,
  calculateIceFloorMazeTimeDeltaMs,
  getIceFloorMazeSpeedReference,
  ICE_FLOOR_MAZE_SCORE_MAXIMUMS,
} from "@/games/ice-floor-maze/score";

// 盤面の外の無い 10×13 で、要素が無く最短6手の問題。基準時間は 130マス × 0.2秒 + 6手 × 2.5秒 = 41秒。
const speedReference = { drawnCellCount: 130, elementCount: 0 };
const optimalMoveCount = 6;
const speedFullScoreMs = 41_000;

describe("getIceFloorMazeSpeedReference", () => {
  const cases = [
    [
      // 3×4 の盤面 `#.b` `.c.` `...` `x.x`。盤面の外が2マス、もろい岩と薄い氷が1つずつ。
      "今の版は盤面の外を除いたマスと、もろい岩・薄い氷を数える",
      {
        generatorVersion: "2",
        seed: "5af044-3-8",
        conditions: { width: 3, height: 4 },
      },
      { drawnCellCount: 10, elementCount: 2 },
    ],
    [
      "初期版は幅 × 高さのマスと要素0にする",
      {
        generatorVersion: "1",
        seed: "8000000000000000-9-63",
        conditions: { width: 8, height: 10 },
      },
      { drawnCellCount: 80, elementCount: 0 },
    ],
  ] as const;

  test.each(cases)("%sこと", (_, identity, expected) => {
    const reference = getIceFloorMazeSpeedReference(identity);

    expect(reference).toEqual(expected);
  });
});

describe("calculateIceFloorMazeSpeedFullScoreMs", () => {
  test("描くマスの数と最短手数から基準時間を算出すること", () => {
    const result = calculateIceFloorMazeSpeedFullScoreMs({
      speedReference,
      optimalMoveCount,
    });

    expect(result).toBe(speedFullScoreMs);
  });

  const cases = [
    [64, 0, 3, 20_300],
    [168, 0, 7, 51_100],
    [64, 7, 14, 103_800],
    [99, 7, 17, 118_300],
    [120, 8, 19, 135_500],
  ] as const;

  test.each(cases)(
    "描くマス %i・要素 %i 個・最短 %i 手の問題では基準時間を %i ミリ秒にすること",
    (drawnCellCount, elementCount, sizedOptimalMoveCount, expected) => {
      const result = calculateIceFloorMazeSpeedFullScoreMs({
        speedReference: { drawnCellCount, elementCount },
        optimalMoveCount: sizedOptimalMoveCount,
      });

      expect(result).toBe(expected);
    },
  );
});

describe("calculateIceFloorMazeSpeedScoreRule", () => {
  test("基準時間の2倍で0点になる規則を返すこと", () => {
    const rule = calculateIceFloorMazeSpeedScoreRule({
      speedReference,
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
      speedReference,
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
      speedReference,
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

  const efficiencyCases = [
    [6, 60],
    [7, 56],
    [9, 51],
    [12, 44],
    [22, 30],
    [28, 25],
  ] as const;

  test.each(efficiencyCases)(
    "総手数 %i 手では効率をゆとり10手を足した最短手数との比で %i 点にすること",
    (moveCount, expected) => {
      const score = calculateIceFloorMazePlayScore({
        elapsedMs: speedFullScoreMs,
        moveCount,
        speedReference,
        optimalMoveCount,
      });

      expect(score.breakdown.efficiency).toBe(expected);
    },
  );

  const oneTrialCases = [
    [3, 56],
    [15, 58],
    [30, 59],
  ] as const;

  test.each(oneTrialCases)(
    "最短 %i 手の問題で1手多ければ、効率を満点より低い %i 点にすること",
    (sizedOptimalMoveCount, expected) => {
      const score = calculateIceFloorMazePlayScore({
        elapsedMs: 0,
        moveCount: sizedOptimalMoveCount + 1,
        speedReference,
        optimalMoveCount: sizedOptimalMoveCount,
      });

      expect(score.breakdown.efficiency).toBe(expected);
    },
  );

  const speedCases = [
    [41_000, 40],
    [51_250, 30],
    [61_500, 20],
    [82_000, 0],
    [120_000, 0],
  ] as const;

  test.each(speedCases)(
    "経過時間 %i ミリ秒では速さを基準時間の超過に応じて %i 点にすること",
    (elapsedMs, expected) => {
      const score = calculateIceFloorMazePlayScore({
        elapsedMs,
        moveCount: optimalMoveCount,
        speedReference,
        optimalMoveCount,
      });

      expect(score.breakdown.speed).toBe(expected);
    },
  );

  test("各評価軸を1点単位へ四捨五入して合計すること", () => {
    const score = calculateIceFloorMazePlayScore({
      elapsedMs: 51_000,
      moveCount: 9,
      speedReference,
      optimalMoveCount,
    });

    expect(score).toEqual({
      total: 81,
      breakdown: { efficiency: 51, speed: 30 },
    });
  });

  describe("時間が基準時間に対して同じ倍率の場合", () => {
    const narrow = {
      elapsedMs: 20_300 * 1.2,
      moveCount: 3,
      speedReference: { drawnCellCount: 64, elementCount: 0 },
      optimalMoveCount: 3,
    };
    const wideWithElements = {
      elapsedMs: 118_300 * 1.2,
      moveCount: 17,
      speedReference: { drawnCellCount: 99, elementCount: 7 },
      optimalMoveCount: 17,
    };

    test("盤面の広さ・要素の数・最短手数が違っても速さを同じ点にすること", () => {
      const narrowScore = calculateIceFloorMazePlayScore(narrow);
      const wideScore = calculateIceFloorMazePlayScore(wideWithElements);

      expect(narrowScore.breakdown.speed).toBe(wideScore.breakdown.speed);
    });
  });

  describe("代表的なプレイ例", () => {
    const plays = [
      { name: "最短手数で速く解いたプレイ", moveCount: 6, elapsedMs: 30_000 },
      {
        name: "1手試し滑りして待ったで戻し、速く解いたプレイ",
        moveCount: 7,
        elapsedMs: 35_000,
      },
      {
        name: "最短手数だが基準を少し超えたプレイ",
        moveCount: 6,
        elapsedMs: 50_000,
      },
      {
        name: "閉じ込められて盤面を戻し、解き直したプレイ",
        moveCount: 10,
        elapsedMs: 41_000,
      },
      {
        name: "最短の2倍の手数を試し滑りして速く解いたプレイ",
        moveCount: 12,
        elapsedMs: 41_000,
      },
      {
        name: "最短手数だが基準の1.5倍の時間がかかったプレイ",
        moveCount: 6,
        elapsedMs: 61_500,
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
            speedReference,
            optimalMoveCount,
          }).total,
        }))
        .sort((left, right) => right.total - left.total)
        .map((play) => play.name);

      expect(ranked).toEqual(expectedOrder);
    });
  });
});
