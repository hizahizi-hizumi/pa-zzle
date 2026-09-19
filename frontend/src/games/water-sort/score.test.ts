import { describe, expect, test } from "vitest";

import {
  calculateWaterSortPlayScore,
  calculateWaterSortSpeedFullScoreMs,
  getWaterSortGameResultLevel,
  WATER_SORT_SCORE_MAXIMUMS,
} from "./score";

describe("calculateWaterSortSpeedFullScoreMs", () => {
  test("初期把握時間と色数と最短手数から基準時間を算出すること", () => {
    const result = calculateWaterSortSpeedFullScoreMs({
      colorCount: 6,
      optimalMoveCount: 10,
    });

    expect(result).toBe(64_000);
  });
});

describe("calculateWaterSortPlayScore", () => {
  test("最短経路を基準時間内かつ手戻りなしで解くと100点になること", () => {
    const score = calculateWaterSortPlayScore({
      elapsedMs: 64_000,
      moveCount: 10,
      completionMoveCount: 10,
      optimalMoveCount: 10,
      colorCount: 6,
    });

    expect(score).toEqual({
      total: 100,
      breakdown: {
        efficiency: WATER_SORT_SCORE_MAXIMUMS.efficiency,
        speed: WATER_SORT_SCORE_MAXIMUMS.speed,
        accuracy: WATER_SORT_SCORE_MAXIMUMS.accuracy,
      },
    });
  });

  test("クリア手数が最短手数の1.5倍なら効率を半分にすること", () => {
    const score = calculateWaterSortPlayScore({
      elapsedMs: 64_000,
      moveCount: 15,
      completionMoveCount: 15,
      optimalMoveCount: 10,
      colorCount: 6,
    });

    expect(score.breakdown.efficiency).toBe(20);
  });

  test("クリア手数が最短手数の2倍以上なら効率を0点にすること", () => {
    const score = calculateWaterSortPlayScore({
      elapsedMs: 64_000,
      moveCount: 20,
      completionMoveCount: 20,
      optimalMoveCount: 10,
      colorCount: 6,
    });

    expect(score.breakdown.efficiency).toBe(0);
  });

  test("基準時間の1.5倍なら速さを半分にすること", () => {
    const score = calculateWaterSortPlayScore({
      elapsedMs: 96_000,
      moveCount: 10,
      completionMoveCount: 10,
      optimalMoveCount: 10,
      colorCount: 6,
    });

    expect(score.breakdown.speed).toBe(20);
  });

  test("基準時間の2倍以上なら速さを0点にすること", () => {
    const score = calculateWaterSortPlayScore({
      elapsedMs: 128_000,
      moveCount: 10,
      completionMoveCount: 10,
      optimalMoveCount: 10,
      colorCount: 6,
    });

    expect(score.breakdown.speed).toBe(0);
  });

  test("手戻りが最短手数の半分なら正確性を半分にすること", () => {
    const score = calculateWaterSortPlayScore({
      elapsedMs: 64_000,
      moveCount: 15,
      completionMoveCount: 10,
      optimalMoveCount: 10,
      colorCount: 6,
    });

    expect(score.breakdown.accuracy).toBe(10);
  });

  test("手戻りが最短手数以上なら正確性を0点にすること", () => {
    const score = calculateWaterSortPlayScore({
      elapsedMs: 64_000,
      moveCount: 20,
      completionMoveCount: 10,
      optimalMoveCount: 10,
      colorCount: 6,
    });

    expect(score.breakdown.accuracy).toBe(0);
  });

  test("各評価軸を1点単位へ四捨五入して合計すること", () => {
    const score = calculateWaterSortPlayScore({
      elapsedMs: 65_000,
      moveCount: 14,
      completionMoveCount: 12,
      optimalMoveCount: 10,
      colorCount: 6,
    });

    expect(score).toEqual({
      total: 87,
      breakdown: {
        efficiency: 32,
        speed: 39,
        accuracy: 16,
      },
    });
  });
});

describe("getWaterSortGameResultLevel", () => {
  test.each([
    [100, "perfect"],
    [99, "great"],
    [90, "great"],
    [89, "good"],
    [80, "good"],
    [79, "clear"],
  ] as const)("スコア %s を %s と評価すること", (score, level) => {
    const result = getWaterSortGameResultLevel(score);

    expect(result).toBe(level);
  });
});
