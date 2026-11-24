import {
  areMagicSquareNumberPadNeighbors,
  getMagicSquareNumberPadColumnCount,
} from "@/games/magic-square/session/number-pad";

describe("getMagicSquareNumberPadColumnCount", () => {
  test("4×4 と 6×6 は8列、5×5 は7列に並べること", () => {
    const counts = [4, 5, 6].map(getMagicSquareNumberPadColumnCount);

    expect(counts).toEqual([8, 7, 8]);
  });
});

describe("areMagicSquareNumberPadNeighbors", () => {
  const cases = [
    ["4×4 の左右の数", 4, 13, 14, true],
    ["4×4 の上下の数", 4, 6, 14, true],
    ["4×4 の斜めの数", 4, 7, 14, true],
    ["4×4 の行の端と次の行の頭の数", 4, 8, 9, false],
    ["4×4 の離れた数", 4, 9, 14, false],
    ["5×5 の上下の数", 5, 1, 8, true],
    ["5×5 の行の端と次の行の頭の数", 5, 7, 8, false],
    ["同じ数", 4, 14, 14, false],
  ] as const;

  test.each(cases)(
    "%sを隣り合うかで分けること",
    (_, size, left, right, expected) => {
      const neighbors = areMagicSquareNumberPadNeighbors(size, left, right);

      expect(neighbors).toBe(expected);
    },
  );
});
