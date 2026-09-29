import {
  countReflectionBoardPieces,
  createEmptyReflectionInventory,
  getReflectionInventoryPieceCount,
  isSameReflectionInventory,
  parseReflectionBoard,
} from "@/games/reflection/puzzle/board";

describe("parseReflectionBoard", () => {
  const rows = ["/\\|", "=o@", "..."];
  const unknownNotationRows = ["/x", ".."];
  const unevenRows = ["/..", "."];

  test("記法の各文字をピースと空きマスへ読み替えること", () => {
    const result = parseReflectionBoard(rows);

    expect(result).toEqual({
      size: 3,
      cells: [
        "slash",
        "backslash",
        "vertical-double",
        "horizontal-double",
        "reflector",
        "black-hole",
        null,
        null,
        null,
      ],
    });
  });

  test("未知の記法を拒否すること", () => {
    const act = () => parseReflectionBoard(unknownNotationRows);

    expect(act).toThrow(RangeError);
  });

  test("行の長さが一辺と違う盤面を拒否すること", () => {
    const act = () => parseReflectionBoard(unevenRows);

    expect(act).toThrow(RangeError);
  });
});

describe("countReflectionBoardPieces", () => {
  const board = parseReflectionBoard(["//.", "o..", "..@"]);

  test("盤面に置かれたピースを種類ごとに数えること", () => {
    const result = countReflectionBoardPieces(board);

    expect(result).toEqual({
      ...createEmptyReflectionInventory(),
      slash: 2,
      reflector: 1,
      "black-hole": 1,
    });
  });
});

describe("getReflectionInventoryPieceCount", () => {
  const inventory = {
    ...createEmptyReflectionInventory(),
    slash: 2,
    "vertical-double": 3,
  };

  test("手持ちのピースの総数を返すこと", () => {
    const result = getReflectionInventoryPieceCount(inventory);

    expect(result).toBe(5);
  });
});

describe("isSameReflectionInventory", () => {
  const inventory = { ...createEmptyReflectionInventory(), slash: 1 };
  const cases = [
    ["同じ個数", { ...inventory }, true],
    [
      "種類が違う",
      { ...createEmptyReflectionInventory(), backslash: 1 },
      false,
    ],
    ["個数が違う", { ...inventory, slash: 2 }, false],
  ] as const;

  test.each(cases)("%s の手持ちを比べること", (_, other, expected) => {
    const result = isSameReflectionInventory(inventory, other);

    expect(result).toBe(expected);
  });
});
