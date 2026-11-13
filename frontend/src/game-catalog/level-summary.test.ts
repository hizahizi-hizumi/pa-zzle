import {
  formatRange,
  mergeRanges,
  summarizeLevelsDistinctly,
} from "@/game-catalog/level-summary";
import type { DifficultyLevel } from "@/games/difficulty";

describe("summarizeLevelsDistinctly", () => {
  const boardSizes: Record<DifficultyLevel, string> = {
    "1": "3×3",
    "2": "4×4",
    "3": "4×4",
    "4": "5×5",
    "5": "6×6",
  };

  test("主な一言がほかのレベルと同じレベルにだけ、違いを表す一言を添えること", () => {
    const summaries = summarizeLevelsDistinctly(
      (difficulty) => boardSizes[difficulty],
      (difficulty) => `段${difficulty}`,
    );

    expect(summaries).toEqual({
      "1": "3×3",
      "2": "4×4・段2",
      "3": "4×4・段3",
      "4": "5×5",
      "5": "6×6",
    });
  });
});

describe("formatRange", () => {
  const cases = [
    [{ minimum: 2, maximum: 3 }, "2〜3手"],
    [{ minimum: 4, maximum: 4 }, "4手"],
    [{ minimum: 8, maximum: Number.POSITIVE_INFINITY }, "8手以上"],
  ] as const;

  test.each(cases)("範囲を単位つきの文言にすること: %o", (range, expected) => {
    const text = formatRange(range, "手");

    expect(text).toBe(expected);
  });
});

describe("mergeRanges", () => {
  const ranges = [
    { minimum: 10, maximum: 13 },
    { minimum: 12, maximum: 16 },
  ];

  test("すべての範囲を含む範囲にすること", () => {
    const merged = mergeRanges(ranges);

    expect(merged).toEqual({ minimum: 10, maximum: 16 });
  });
});
