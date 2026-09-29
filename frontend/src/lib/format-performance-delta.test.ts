import {
  formatCountDelta,
  formatElapsedTimeDelta,
} from "@/lib/format-performance-delta";

describe("formatElapsedTimeDelta", () => {
  const cases = [
    ["基準と一致", 0, "±00:00"],
    ["基準より遅い", 10_000, "+00:10"],
    ["基準より速い", -65_000, "-01:05"],
    ["1秒未満だけ速い", -500, "-00:00"],
  ] as const;

  test.each(cases)(
    "基準時間との差に符号を付けること: %s",
    (_, timeDeltaMs, expected) => {
      const result = formatElapsedTimeDelta(timeDeltaMs);

      expect(result).toBe(expected);
    },
  );
});

describe("formatCountDelta", () => {
  const cases = [
    ["一致", 0, "±0"],
    ["多い", 12, "+12"],
    ["少ない", -3, "-3"],
  ] as const;

  test.each(cases)(
    "回数の差に符号を付けること: %s",
    (_, countDelta, expected) => {
      const result = formatCountDelta(countDelta);

      expect(result).toBe(expected);
    },
  );
});
