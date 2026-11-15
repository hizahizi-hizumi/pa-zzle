import {
  _private,
  calculateWaterSortMoveDelta,
  calculateWaterSortPlayScore,
  calculateWaterSortSpeedScoreRule,
  calculateWaterSortTimeDeltaMs,
  WATER_SORT_SCORE_MAXIMUMS,
} from "@/games/water-sort/score";

const { calculateWaterSortSpeedFullScoreMs } = _private;

describe("calculateWaterSortSpeedFullScoreMs", () => {
  test("初期把握時間と色数と最短手数から基準時間を算出すること", () => {
    const result = calculateWaterSortSpeedFullScoreMs({
      colorCount: 6,
      optimalMoveCount: 10,
    });

    expect(result).toBe(64_000);
  });
});

describe("calculateWaterSortTimeDeltaMs", () => {
  test("実時間と問題ごとの基準時間との差を算出すること", () => {
    const result = calculateWaterSortTimeDeltaMs({
      elapsedMs: 65_000,
      colorCount: 6,
      optimalMoveCount: 10,
    });

    expect(result).toBe(1_000);
  });
});

describe("calculateWaterSortMoveDelta", () => {
  test("クリア手数と最短手数との差を算出すること", () => {
    const result = calculateWaterSortMoveDelta({
      completionMoveCount: 12,
      optimalMoveCount: 10,
    });

    expect(result).toBe(2);
  });
});

describe("calculateWaterSortSpeedScoreRule", () => {
  test("基準時間の2倍で0点になる規則を返すこと", () => {
    const rule = calculateWaterSortSpeedScoreRule({
      colorCount: 6,
      optimalMoveCount: 10,
    });

    expect(rule).toEqual({ fullScoreMs: 64_000, zeroScoreMs: 128_000 });
  });
});

describe("calculateWaterSortPlayScore", () => {
  const base = {
    elapsedMs: 64_000,
    moveCount: 10,
    optimalMoveCount: 10,
    colorCount: 6,
  };

  test("最短手数かつ基準時間内で解くと100点になること", () => {
    const score = calculateWaterSortPlayScore(base);

    expect(score).toEqual({
      total: 100,
      breakdown: {
        efficiency: WATER_SORT_SCORE_MAXIMUMS.efficiency,
        speed: WATER_SORT_SCORE_MAXIMUMS.speed,
      },
    });
  });

  test("経路に残らない注ぎも効率へ含め、余分な注ぎ5手で45点にすること", () => {
    const score = calculateWaterSortPlayScore({ ...base, moveCount: 15 });

    expect(score.breakdown.efficiency).toBe(45);
  });

  test("総注ぎ手数が最短手数の3倍以上なら効率を0点にすること", () => {
    const score = calculateWaterSortPlayScore({ ...base, moveCount: 30 });

    expect(score.breakdown.efficiency).toBe(0);
  });

  test("同じ実注ぎ手数ならやり直し方法に関係なく同じ効率となること", () => {
    const score = calculateWaterSortPlayScore({ ...base, moveCount: 12 });

    expect(score).toEqual({
      total: 94,
      breakdown: { efficiency: 54, speed: 40 },
    });
  });

  test("基準時間の1.5倍なら速さを半分にすること", () => {
    const score = calculateWaterSortPlayScore({ ...base, elapsedMs: 96_000 });

    expect(score.breakdown.speed).toBe(20);
  });

  test("基準時間の2倍以上なら速さを0点にすること", () => {
    const score = calculateWaterSortPlayScore({ ...base, elapsedMs: 128_000 });

    expect(score.breakdown.speed).toBe(0);
  });

  test("各評価軸を1点単位へ四捨五入して合計すること", () => {
    const score = calculateWaterSortPlayScore({
      ...base,
      elapsedMs: 65_000,
      moveCount: 14,
    });

    expect(score).toEqual({
      total: 87,
      breakdown: { efficiency: 48, speed: 39 },
    });
  });
});
