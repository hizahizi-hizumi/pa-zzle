import {
  getTakuzuLineCellIndices,
  parseTakuzuBoard,
} from "@/games/takuzu/puzzle/board";

describe("parseTakuzuBoard", () => {
  const rows = ["A.", "B."];
  const unknownNotationRows = ["A0", "B."];
  const oddSizeRows = ["A.B", "B.A", "..."];
  const unevenRows = ["A.B", "B"];

  test("記法の A・B・. をタイルと空きマスへ読み替えること", () => {
    const result = parseTakuzuBoard(rows);

    expect(result).toEqual({ size: 2, cells: ["a", null, "b", null] });
  });

  test("未知の記法を拒否すること", () => {
    const act = () => parseTakuzuBoard(unknownNotationRows);

    expect(act).toThrow(RangeError);
  });

  test("一辺が奇数の盤面を拒否すること", () => {
    const act = () => parseTakuzuBoard(oddSizeRows);

    expect(act).toThrow(RangeError);
  });

  test("行の長さが一辺と違う盤面を拒否すること", () => {
    const act = () => parseTakuzuBoard(unevenRows);

    expect(act).toThrow(RangeError);
  });
});

describe("getTakuzuLineCellIndices", () => {
  const cases = [
    ["row", 1, [4, 5, 6, 7]],
    ["column", 2, [2, 6, 10, 14]],
  ] as const;

  test.each(cases)(
    "%s %i のマスを端から順に返すこと",
    (axis, index, expected) => {
      const result = getTakuzuLineCellIndices(4, { axis, index });

      expect(result).toEqual(expected);
    },
  );
});
