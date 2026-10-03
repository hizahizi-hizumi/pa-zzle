import {
  getTakuzuGridLineCellIndices,
  getTakuzuLineCellIndices,
  listTakuzuGridLines,
  parseTakuzuBoard,
  parseTakuzuGrid,
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

describe("parseTakuzuGrid", () => {
  const singleRow = ["AA."];
  const unevenRows = ["A.B", "B"];

  test("1行だけの並びを行数と列数とともに読むこと", () => {
    const result = parseTakuzuGrid(singleRow);

    expect(result).toEqual({
      shape: { rowCount: 1, columnCount: 3 },
      cells: ["a", "a", null],
    });
  });

  test("長さの違う行を拒否すること", () => {
    const act = () => parseTakuzuGrid(unevenRows);

    expect(act).toThrow(RangeError);
  });
});

describe("listTakuzuGridLines", () => {
  const cases = [
    ["1行4列", { rowCount: 1, columnCount: 4 }, [{ axis: "row", index: 0 }]],
    [
      "2行2列",
      { rowCount: 2, columnCount: 2 },
      [
        { axis: "row", index: 0 },
        { axis: "row", index: 1 },
        { axis: "column", index: 0 },
        { axis: "column", index: 1 },
      ],
    ],
  ] as const;

  test.each(cases)(
    "1マスしかない並びを除いた行・列を返すこと: %s",
    (_, shape, expected) => {
      const result = listTakuzuGridLines(shape);

      expect(result).toEqual(expected);
    },
  );
});

describe("getTakuzuGridLineCellIndices", () => {
  const shape = { rowCount: 2, columnCount: 3 };
  const cases = [
    ["row", 1, [3, 4, 5]],
    ["column", 2, [2, 5]],
  ] as const;

  test.each(cases)(
    "%s %i のマスを端から順に返すこと",
    (axis, index, expected) => {
      const result = getTakuzuGridLineCellIndices(shape, { axis, index });

      expect(result).toEqual(expected);
    },
  );
});
