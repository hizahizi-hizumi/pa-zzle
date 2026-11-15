import {
  areNanpureCellsRelated,
  assertNanpureBoard,
  getNanpureBlockIndex,
  getNanpureColumnIndex,
  getNanpureRowIndex,
  isNanpureDigit,
  NANPURE_CELL_COUNT,
  type NanpureBoard,
} from "@/games/nanpure/puzzle/board";

describe("isNanpureDigit", () => {
  const validDigits = [1, 5, 9] as const;
  const invalidDigits = [0, 10, 1.5, null, "1"] as const;

  test.each(validDigits)("1〜9の整数を数字として受理すること: %s", (value) => {
    const result = isNanpureDigit(value);

    expect(result).toBe(true);
  });

  test.each(invalidDigits)(
    "1〜9以外の値を数字として拒否すること: %s",
    (value) => {
      const result = isNanpureDigit(value);

      expect(result).toBe(false);
    },
  );
});

describe("セルの位置", () => {
  const cellIndex = 50;

  test("セル番号から行・列・ブロックを算出できること", () => {
    const row = getNanpureRowIndex(cellIndex);
    const column = getNanpureColumnIndex(cellIndex);
    const block = getNanpureBlockIndex(cellIndex);

    expect({ row, column, block }).toEqual({ row: 5, column: 5, block: 4 });
  });
});

describe("areNanpureCellsRelated", () => {
  const cases = [
    ["同じ行", 0, 8, true],
    ["同じ列", 0, 72, true],
    ["同じブロック", 0, 20, true],
    ["別の行・列・ブロック", 0, 40, false],
  ] as const;

  test.each(cases)(
    "%sのマスを関連マスとして判定すること",
    (_, first, second, expected) => {
      const related = areNanpureCellsRelated(first, second);

      expect(related).toBe(expected);
    },
  );
});

describe("assertNanpureBoard", () => {
  const board = Array.from({ length: NANPURE_CELL_COUNT - 1 }, () => null);

  test("81マスではない盤面を拒否すること", () => {
    const act = () => assertNanpureBoard(board as NanpureBoard);

    expect(act).toThrow("Nanpure board must contain 81 cells");
  });
});
