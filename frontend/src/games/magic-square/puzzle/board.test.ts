import {
  assertMagicSquareBoard,
  getMagicSquareLineCellIndices,
  getMagicSquareMagicSum,
  isSameMagicSquareLine,
  listMagicSquareLines,
  listMagicSquareLinesThroughCell,
  type MagicSquareLine,
  parseMagicSquareBoard,
} from "@/games/magic-square/puzzle/board";

describe("getMagicSquareMagicSum", () => {
  const cases = [
    [3, 15],
    [4, 34],
    [5, 65],
    [6, 111],
  ] as const;

  test.each(cases)("一辺 %i の合計を %i にすること", (size, expected) => {
    const magicSum = getMagicSquareMagicSum(size);

    expect(magicSum).toBe(expected);
  });
});

describe("listMagicSquareLines", () => {
  const cases = [
    [4, 10],
    [5, 12],
    [6, 14],
  ] as const;

  test.each(cases)(
    "一辺 %i の盤面で、行・縦の列・斜め2本の %i 本を返すこと",
    (size, expected) => {
      const lines = listMagicSquareLines(size);

      expect(lines).toHaveLength(expected);
    },
  );
});

describe("getMagicSquareLineCellIndices", () => {
  const cases: readonly [string, MagicSquareLine, readonly number[]][] = [
    ["2行目", { kind: "row", index: 1 }, [4, 5, 6, 7]],
    ["3列目", { kind: "column", index: 2 }, [2, 6, 10, 14]],
    ["左上からの斜め", { kind: "diagonal", from: "top-left" }, [0, 5, 10, 15]],
    ["右上からの斜め", { kind: "diagonal", from: "top-right" }, [3, 6, 9, 12]],
  ];

  test.each(cases)(
    "4×4 の%sのマスを上から順に返すこと",
    (_, line, expected) => {
      const cellIndices = getMagicSquareLineCellIndices(4, line);

      expect(cellIndices).toEqual(expected);
    },
  );
});

describe("listMagicSquareLinesThroughCell", () => {
  const cases: readonly [string, number, readonly MagicSquareLine[]][] = [
    [
      "中央",
      12,
      [
        { kind: "row", index: 2 },
        { kind: "column", index: 2 },
        { kind: "diagonal", from: "top-left" },
        { kind: "diagonal", from: "top-right" },
      ],
    ],
    [
      "左上の角",
      0,
      [
        { kind: "row", index: 0 },
        { kind: "column", index: 0 },
        { kind: "diagonal", from: "top-left" },
      ],
    ],
    [
      "上の辺",
      1,
      [
        { kind: "row", index: 0 },
        { kind: "column", index: 1 },
      ],
    ],
  ];

  test.each(cases)(
    "5×5 の%sのマスを通る列を返すこと",
    (_, cellIndex, expected) => {
      const lines = listMagicSquareLinesThroughCell(5, cellIndex);

      expect(lines).toEqual(expected);
    },
  );
});

describe("isSameMagicSquareLine", () => {
  const cases: readonly [string, MagicSquareLine, MagicSquareLine, boolean][] =
    [
      ["同じ行", { kind: "row", index: 1 }, { kind: "row", index: 1 }, true],
      [
        "番号の同じ行と縦の列",
        { kind: "row", index: 1 },
        { kind: "column", index: 1 },
        false,
      ],
      [
        "向きの違う斜め",
        { kind: "diagonal", from: "top-left" },
        { kind: "diagonal", from: "top-right" },
        false,
      ],
      [
        "行と斜め",
        { kind: "row", index: 0 },
        { kind: "diagonal", from: "top-left" },
        false,
      ],
    ];

  test.each(cases)("%sを見分けること", (_, left, right, expected) => {
    const same = isSameMagicSquareLine(left, right);

    expect(same).toBe(expected);
  });
});

describe("parseMagicSquareBoard", () => {
  const rows = ["16 . . 13", ". 10 11 .", "9 . . 12", ". 15 14 1"];

  test("数と空きマスを行優先で読むこと", () => {
    const board = parseMagicSquareBoard(rows);

    expect(board).toEqual({
      size: 4,
      cells: [
        16,
        null,
        null,
        13,
        null,
        10,
        11,
        null,
        9,
        null,
        null,
        12,
        null,
        15,
        14,
        1,
      ],
    });
  });

  const invalidCases = [
    ["行の長さが一辺と違う盤面", ["1 2 3", "4 5 6", "7 8"]],
    ["同じ数を2回置いた盤面", ["1 2 3", "4 5 6", "7 8 8"]],
    ["範囲外の数を置いた盤面", ["1 2 3", "4 5 6", "7 8 10"]],
    ["数でない記法", ["1 2 3", "4 x 6", "7 8 9"]],
  ] as const;

  test.each(invalidCases)("%sを受け付けないこと", (_, invalidRows) => {
    const act = () => parseMagicSquareBoard(invalidRows);

    expect(act).toThrow(RangeError);
  });
});

describe("assertMagicSquareBoard", () => {
  const invalidCases = [
    ["マスの数が一辺の2乗と違う盤面", { size: 3, cells: [1, 2, 3] }],
    ["一辺が整数でない盤面", { size: 1.5, cells: [1] }],
  ] as const;

  test.each(invalidCases)("%sを受け付けないこと", (_, board) => {
    const act = () => assertMagicSquareBoard(board);

    expect(act).toThrow(RangeError);
  });
});
