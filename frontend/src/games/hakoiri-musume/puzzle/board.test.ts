import {
  getHakoiriMusumeArrangementKey,
  hakoiriMusumePieceShapes,
  isHakoiriMusumePieceInsideBoard,
  listHakoiriMusumePieceCells,
} from "@/games/hakoiri-musume/puzzle/board";

const size = { columns: 5, rows: 6 };

describe("hakoiriMusumePieceShapes", () => {
  const cases = [
    [
      "┗",
      "bend-up-right",
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    ],
    [
      "┛",
      "bend-up-left",
      [
        [0, 1],
        [1, 0],
        [1, 1],
      ],
    ],
    [
      "┏",
      "bend-down-right",
      [
        [0, 0],
        [0, 1],
        [1, 0],
      ],
    ],
    [
      "┓",
      "bend-down-left",
      [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
    ],
  ] as const;

  test.each(cases)(
    "L字の形が、外接矩形の左上からの3マスを占めること: %s",
    (_, kind, expected) => {
      const { columns, rows, cells } = hakoiriMusumePieceShapes[kind];

      expect({ columns, rows }).toEqual({ columns: 2, rows: 2 });
      expect(cells.map(({ row, column }) => [row, column])).toEqual(expected);
    },
  );
});

describe("listHakoiriMusumePieceCells", () => {
  const cases = [
    ["2×2", { kind: "square", cell: 6 }, [6, 7, 11, 12]],
    ["縦長", { kind: "vertical", cell: 4 }, [4, 9]],
    [
      "┛ は外接矩形の左上を占めない",
      { kind: "bend-up-left", cell: 0 },
      [1, 5, 6],
    ],
  ] as const;

  test.each(cases)(
    "盤の幅でマスの番号を数えること: %s",
    (_, piece, expected) => {
      const cells = listHakoiriMusumePieceCells(size, piece);

      expect(cells).toEqual(expected);
    },
  );
});

describe("isHakoiriMusumePieceInsideBoard", () => {
  const cases = [
    ["右下の角に収まる2×2", { row: 4, column: 3 }, true],
    ["右の端からはみ出す2×2", { row: 0, column: 4 }, false],
    ["下の端からはみ出す2×2", { row: 5, column: 0 }, false],
  ] as const;

  test.each(cases)(
    "外接矩形が盤に収まるかを確かめること: %s",
    (_, position, expected) => {
      const inside = isHakoiriMusumePieceInsideBoard(size, "square", position);

      expect(inside).toBe(expected);
    },
  );
});

describe("getHakoiriMusumeArrangementKey", () => {
  test("目標でない同じ形の駒どうしが入れ替わっただけの並びを同じとみなすこと", () => {
    const left = getHakoiriMusumeArrangementKey([
      { kind: "small", cell: 0, target: null },
      { kind: "small", cell: 4, target: null },
    ]);
    const right = getHakoiriMusumeArrangementKey([
      { kind: "small", cell: 4, target: null },
      { kind: "small", cell: 0, target: null },
    ]);

    expect(left).toBe(right);
  });

  test("同じ形でも、目標の駒とほかの駒が入れ替わった並びは見分けること", () => {
    const left = getHakoiriMusumeArrangementKey([
      { kind: "horizontal", cell: 0, target: 1 },
      { kind: "horizontal", cell: 10, target: null },
    ]);
    const right = getHakoiriMusumeArrangementKey([
      { kind: "horizontal", cell: 10, target: 1 },
      { kind: "horizontal", cell: 0, target: null },
    ]);

    expect(left).not.toBe(right);
  });
});
