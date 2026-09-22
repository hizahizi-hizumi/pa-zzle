import {
  areNanpureCellsRelated,
  assertNanpureBoard,
  getNanpureBlockIndex,
  getNanpureColumnIndex,
  getNanpureRowIndex,
  isNanpureDigit,
  NANPURE_CELL_COUNT,
  type NanpureBoard,
} from "./board";

describe("isNanpureDigit", () => {
  const acceptedCases = [1, 5, 9] as const;
  const rejectedCases = [0, 10, 1.5, null, "1"] as const;

  test.each(acceptedCases)(
    "1〜9の整数を数字として受理すること: %s",
    (value) => {
      const result = isNanpureDigit(value);

      expect(result).toBe(true);
    },
  );

  test.each(rejectedCases)(
    "1〜9以外の値を数字として拒否すること: %s",
    (value) => {
      const result = isNanpureDigit(value);

      expect(result).toBe(false);
    },
  );
});

describe("セル位置", () => {
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
    [0, 8, true],
    [0, 72, true],
    [0, 20, true],
    [0, 40, false],
  ] as const;

  test.each(cases)(
    "2つのマスの行・列・ブロック関係を判定すること: %i, %i",
    (first, second, expected) => {
      const result = areNanpureCellsRelated(first, second);

      expect(result).toBe(expected);
    },
  );
});

describe("assertNanpureBoard", () => {
  const invalidBoard = Array.from(
    { length: NANPURE_CELL_COUNT - 1 },
    () => null,
  ) as NanpureBoard;

  test("81マスではない盤面を拒否すること", () => {
    const act = () => assertNanpureBoard(invalidBoard);

    expect(act).toThrow("Nanpure board must contain 81 cells");
  });
});
