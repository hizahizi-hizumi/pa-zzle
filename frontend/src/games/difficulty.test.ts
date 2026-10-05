import {
  getDifficultyLabel,
  parseDifficultyLevel,
  parseLegacyDifficulty,
  parseRecordedDifficulty,
} from "@/games/difficulty";

describe("parseDifficultyLevel", () => {
  const definedCases = ["1", "2", "3", "4", "5"] as const;
  const undefinedCases = [undefined, "", "0", "6", "easy", "normal", "hard"];

  test.each(definedCases)("%s を難易度として受理すること", (input) => {
    const result = parseDifficultyLevel(input);

    expect(result).toBe(input);
  });

  test.each(undefinedCases)("%s を難易度として拒否すること", (input) => {
    const result = parseDifficultyLevel(input);

    expect(result).toBeUndefined();
  });
});

describe("parseLegacyDifficulty", () => {
  const definedCases = ["easy", "normal", "hard"] as const;
  const undefinedCases = [undefined, "", "1", "expert"];

  test.each(definedCases)("%s を旧3段階の難易度として受理すること", (input) => {
    const result = parseLegacyDifficulty(input);

    expect(result).toBe(input);
  });

  test.each(undefinedCases)(
    "%s を旧3段階の難易度として拒否すること",
    (input) => {
      const result = parseLegacyDifficulty(input);

      expect(result).toBeUndefined();
    },
  );
});

describe("parseRecordedDifficulty", () => {
  const cases = [
    ["3", "3"],
    ["hard", "hard"],
    ["expert", undefined],
    [undefined, undefined],
  ] as const;

  test.each(cases)(
    "記録の難易度をレベルと旧3段階の両方で読むこと: %s",
    (value, expected) => {
      const result = parseRecordedDifficulty(value);

      expect(result).toBe(expected);
    },
  );
});

describe("getDifficultyLabel", () => {
  const cases = [
    ["1", "レベル 1"],
    ["5", "レベル 5"],
    ["easy", "かんたん"],
    ["normal", "ふつう"],
    ["hard", "むずかしい"],
  ] as const;

  test.each(cases)(
    "レベルと旧3段階の表示名を返すこと: %s",
    (difficulty, expected) => {
      const result = getDifficultyLabel(difficulty);

      expect(result).toBe(expected);
    },
  );
});
