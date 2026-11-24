import {
  countMaskValues,
  fullMask,
  hasMaskValue,
  highestMaskValue,
  intersectMasks,
  isSingleValueMask,
  listMaskValues,
  lowestMaskValue,
  maskOfValue,
  rangeMask,
  subtractMask,
  uniteMasks,
} from "@/games/magic-square/problem/generation/value-mask";

// 6×6 の数 1〜36 は 32 ビットを超えるので、32 をまたぐ数で確かめる。
const maskOf = (values: readonly number[]) =>
  values.reduce((mask, value) => uniteMasks(mask, maskOfValue(value)), 0);

describe("uniteMasks・intersectMasks・subtractMask", () => {
  const left = maskOf([1, 5, 31, 32, 36]);
  const right = maskOf([5, 30, 32, 33]);

  test("32 をまたぐ数の和・共通・差を返すこと", () => {
    const union = uniteMasks(left, right);
    const intersection = intersectMasks(left, right);
    const difference = subtractMask(left, right);

    expect({
      union: listMaskValues(union),
      intersection: listMaskValues(intersection),
      difference: listMaskValues(difference),
    }).toEqual({
      union: [1, 5, 30, 31, 32, 33, 36],
      intersection: [5, 32],
      difference: [1, 31, 36],
    });
  });
});

describe("countMaskValues・lowestMaskValue・highestMaskValue", () => {
  const cases = [
    ["3", maskOf([3]), 1, 3, 3],
    ["1・31", maskOf([1, 31]), 2, 1, 31],
    ["32・36", maskOf([32, 36]), 2, 32, 36],
    ["2・17・33・35", maskOf([2, 17, 33, 35]), 4, 2, 35],
  ] as const;

  test.each(cases)(
    "%s の数の個数と最小と最大を返すこと",
    (_, mask, count, lowest, highest) => {
      const result = {
        count: countMaskValues(mask),
        lowest: lowestMaskValue(mask),
        highest: highestMaskValue(mask),
      };

      expect(result).toEqual({ count, lowest, highest });
    },
  );
});

describe("hasMaskValue・isSingleValueMask", () => {
  const mask = maskOf([4, 34]);

  test("入っている数だけを真にし、1つだけの集まりを見分けること", () => {
    const has = [4, 34, 5, 33].map((value) => hasMaskValue(mask, value));
    const single = [mask, maskOfValue(34), 0].map(isSingleValueMask);

    expect({ has, single }).toEqual({
      has: [true, true, false, false],
      single: [false, true, false],
    });
  });
});

describe("rangeMask", () => {
  const cases = [
    [-3, 2, 36, [1, 2]],
    [30, 40, 36, [30, 31, 32, 33, 34, 35, 36]],
    [10, 9, 36, []],
  ] as const;

  test.each(cases)(
    "%i〜%i を 1〜%i の中で切った集まりを返すこと",
    (from, to, maxValue, expected) => {
      const result = listMaskValues(rangeMask(from, to, maxValue));

      expect(result).toEqual(expected);
    },
  );
});

describe("fullMask", () => {
  test("6×6 の数 1〜36 の全部を返すこと", () => {
    const result = fullMask(36);

    expect(listMaskValues(result)).toEqual(
      Array.from({ length: 36 }, (_, index) => index + 1),
    );
  });
});
