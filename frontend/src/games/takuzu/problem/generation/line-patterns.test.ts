import {
  _private,
  getTakuzuLinePatternTile,
  isTakuzuLinePatternConsistent,
  listLegalTakuzuLinePatterns,
  readTakuzuLineKnowledge,
} from "@/games/takuzu/problem/generation/line-patterns";

const { hasRunOfThree } = _private;

describe("listLegalTakuzuLinePatterns", () => {
  const cases = [
    [4, 6],
    [6, 14],
    [8, 34],
  ] as const;

  test.each(cases)(
    "一辺 %i の行に置ける並びが %i 通りであること",
    (size, expectedCount) => {
      const result = listLegalTakuzuLinePatterns(size);

      expect(result).toHaveLength(expectedCount);
    },
  );

  test("どの並びも2種類が半分ずつで3つ続かないこと", () => {
    const result = listLegalTakuzuLinePatterns(8);

    expect(
      result.every(
        (pattern) =>
          _private.countBits(pattern) === 4 && !hasRunOfThree(pattern, 8),
      ),
    ).toBe(true);
  });
});

describe("hasRunOfThree", () => {
  const cases = [
    ["途中で b が3つ続く並び", 0b0011100, 7, true],
    ["先頭で a が3つ続く並び", 0b1111000, 7, true],
    ["2つまでしか続かない並び", 0b0110011, 7, false],
  ] as const;

  test.each(cases)("%s を判定できること", (_, pattern, size, expected) => {
    const result = hasRunOfThree(pattern, size);

    expect(result).toBe(expected);
  });
});

describe("readTakuzuLineKnowledge", () => {
  const cells = ["a", null, "b", "b"] as const;

  test("置かれた位置と b の位置をビットで返すこと", () => {
    const result = readTakuzuLineKnowledge(cells);

    expect(result).toEqual({ knownMask: 0b1101, knownValue: 0b1100 });
  });
});

describe("isTakuzuLinePatternConsistent", () => {
  const knowledge = readTakuzuLineKnowledge(["a", null, "b", null]);
  const cases = [
    ["置かれたタイルと一致する並び", 0b0100, true],
    ["置かれたタイルと食い違う並び", 0b0011, false],
  ] as const;

  test.each(cases)("%s を判定できること", (_, pattern, expected) => {
    const result = isTakuzuLinePatternConsistent(pattern, knowledge);

    expect(result).toBe(expected);
  });
});

describe("getTakuzuLinePatternTile", () => {
  const pattern = 0b10;

  test("ビットが 1 の位置を b、0 の位置を a として読むこと", () => {
    const result = [0, 1].map((position) =>
      getTakuzuLinePatternTile(pattern, position),
    );

    expect(result).toEqual(["a", "b"]);
  });
});
