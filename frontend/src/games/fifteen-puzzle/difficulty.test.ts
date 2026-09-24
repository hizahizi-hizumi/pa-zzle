// @vitest-environment node

import {
  getFifteenPuzzleDifficultyLabel,
  parseFifteenPuzzleDifficulty,
} from "@/games/fifteen-puzzle/difficulty";

describe("parseFifteenPuzzleDifficulty", () => {
  const cases = [
    ["1", "1"],
    ["5", "5"],
    ["0", undefined],
    ["6", undefined],
    ["easy", undefined],
    [undefined, undefined],
  ] as const;

  test.each(cases)(
    "レベル 1〜5 の ID だけを難易度として認めること: %s",
    (value, expected) => {
      const result = parseFifteenPuzzleDifficulty(value);

      expect(result).toBe(expected);
    },
  );
});

describe("getFifteenPuzzleDifficultyLabel", () => {
  const cases = [
    ["1", "レベル 1"],
    ["5", "レベル 5"],
  ] as const;

  test.each(cases)("難易度の表示名を返すこと: %s", (difficulty, expected) => {
    const result = getFifteenPuzzleDifficultyLabel(difficulty);

    expect(result).toBe(expected);
  });
});
