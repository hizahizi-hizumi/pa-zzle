import {
  isFiniteNumber,
  isNonEmptyString,
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isPositiveInteger,
  isRecordObject,
} from "@/lib/type-guards";

describe("isRecordObject", () => {
  const cases = [
    ["空のオブジェクト", {}, true],
    ["プロパティのあるオブジェクト", { id: "a" }, true],
    ["null", null, false],
    ["配列", [], false],
    ["文字列", "a", false],
    ["undefined", undefined, false],
  ] as const;

  test.each(cases)(
    "オブジェクトだけを受け入れること: %s",
    (_, value, expected) => {
      const result = isRecordObject(value);

      expect(result).toBe(expected);
    },
  );
});

describe("isNonEmptyString", () => {
  const cases = [
    ["1文字以上の文字列", "a", true],
    ["空文字列", "", false],
    ["数", 1, false],
  ] as const;

  test.each(cases)(
    "空でない文字列だけを受け入れること: %s",
    (_, value, expected) => {
      const result = isNonEmptyString(value);

      expect(result).toBe(expected);
    },
  );
});

describe("isFiniteNumber", () => {
  const cases = [
    ["負の小数", -1.5, true],
    ["NaN", Number.NaN, false],
    ["無限大", Number.POSITIVE_INFINITY, false],
    ["数字の文字列", "1", false],
  ] as const;

  test.each(cases)("有限の数だけを受け入れること: %s", (_, value, expected) => {
    const result = isFiniteNumber(value);

    expect(result).toBe(expected);
  });
});

describe("isNonNegativeFiniteNumber", () => {
  const cases = [
    ["0", 0, true],
    ["正の小数", 0.5, true],
    ["負の数", -0.5, false],
    ["無限大", Number.POSITIVE_INFINITY, false],
  ] as const;

  test.each(cases)(
    "0以上の有限の数だけを受け入れること: %s",
    (_, value, expected) => {
      const result = isNonNegativeFiniteNumber(value);

      expect(result).toBe(expected);
    },
  );
});

describe("isNonNegativeInteger", () => {
  const cases = [
    ["0", 0, true],
    ["正の整数", 3, true],
    ["負の整数", -1, false],
    ["小数", 1.5, false],
    ["数字の文字列", "1", false],
  ] as const;

  test.each(cases)(
    "0以上の整数だけを受け入れること: %s",
    (_, value, expected) => {
      const result = isNonNegativeInteger(value);

      expect(result).toBe(expected);
    },
  );
});

describe("isPositiveInteger", () => {
  const cases = [
    ["1", 1, true],
    ["0", 0, false],
    ["小数", 1.5, false],
  ] as const;

  test.each(cases)(
    "1以上の整数だけを受け入れること: %s",
    (_, value, expected) => {
      const result = isPositiveInteger(value);

      expect(result).toBe(expected);
    },
  );
});
