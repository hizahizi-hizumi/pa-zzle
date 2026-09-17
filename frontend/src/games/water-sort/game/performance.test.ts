import { describe, expect, test } from "vitest";

import { calculateWaterSortPlayScore } from "./performance";

describe("calculateWaterSortPlayScore", () => {
  test("最短手数でのクリアを100点として評価すること", () => {
    const score = calculateWaterSortPlayScore(12, 12);

    expect(score).toBe(100);
  });

  test("最短手数に対する実手数の比率で評価すること", () => {
    const score = calculateWaterSortPlayScore(12, 10);

    expect(score).toBe(83);
  });

  test("最短手数より小さい入力でも100点を超えないこと", () => {
    const score = calculateWaterSortPlayScore(8, 10);

    expect(score).toBe(100);
  });
});
