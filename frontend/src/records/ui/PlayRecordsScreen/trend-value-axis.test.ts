import { describe, expect, test } from "vitest";

import { getTrendValueAxis } from "./trend-value-axis";

describe("getTrendValueAxis", () => {
  const integerScoreAxis = {
    kind: "integer" as const,
    minimum: 0,
    maximum: 100,
  };
  const integerCountAxis = { kind: "integer" as const, minimum: 0 };
  const durationAxis = { kind: "duration-ms" as const };
  const boundedDurationAxis = { kind: "duration-ms" as const, minimum: 0 };
  const scoreValues = [77, 100];
  const smallCountValues = [0, 5];
  const wideCountValues = [0, 22];
  const overRangeScoreValues = [95, 105];
  const secondScaleDurationValues = [-57_000, 0, 46_000];
  const minuteScaleDurationValues = [10 * 60_000, 27 * 60_000];
  const zeroDurationValues = [0];

  test("整数スコアを5刻みの整数目盛りへ揃えつつ上下の余白を維持すること", () => {
    const axis = getTrendValueAxis(scoreValues, integerScoreAxis);

    expect(axis.domain).toEqual([74.7, 102.3]);
    expect(axis.ticks).toEqual([75, 80, 85, 90, 95, 100]);
  });

  test("小さい整数差分を1刻みの整数目盛りへ揃えること", () => {
    const axis = getTrendValueAxis(smallCountValues, integerCountAxis);

    expect(axis.domain).toEqual([-0.5, 5.5]);
    expect(axis.ticks).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test("整数値域が広いと1・2・5系列で目盛り間隔を広げること", () => {
    const axis = getTrendValueAxis(wideCountValues, integerCountAxis);

    expect(axis.ticks).toEqual([0, 5, 10, 15, 20]);
  });

  test("宣言した範囲を実データが超えたときは実データを隠さないこと", () => {
    const axis = getTrendValueAxis(overRangeScoreValues, integerScoreAxis);

    expect(axis.ticks).toEqual([94, 96, 98, 100, 102, 104, 106]);
  });

  test("秒単位の時間差を時計として読みやすい30秒刻みへ揃えること", () => {
    const axis = getTrendValueAxis(secondScaleDurationValues, durationAxis);

    expect(axis.ticks).toEqual([-60_000, -30_000, 0, 30_000]);
  });

  test("分単位の経過時間を時計として読みやすい5分刻みへ揃えること", () => {
    const axis = getTrendValueAxis(
      minuteScaleDurationValues,
      boundedDurationAxis,
    );

    expect(axis.ticks).toEqual([
      10 * 60_000,
      15 * 60_000,
      20 * 60_000,
      25 * 60_000,
    ]);
  });

  test("時間差が基準値だけでもミリ秒未満のような重複表示用目盛りを作らないこと", () => {
    const axis = getTrendValueAxis(zeroDurationValues, durationAxis);

    expect(axis.ticks).toEqual([0]);
  });

  test("軸指定のない指標は既存の連続値域を維持すること", () => {
    const axis = getTrendValueAxis(scoreValues, undefined);

    expect(axis.domain).toEqual([74.7, 102.3]);
    expect(axis.ticks).toBeUndefined();
  });
});
