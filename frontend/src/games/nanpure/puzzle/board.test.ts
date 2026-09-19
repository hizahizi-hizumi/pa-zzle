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
  test.each([1, 5, 9])("1〜9の整数を数字として受理すること: %s", (value) => {
    const result = isNanpureDigit(value);

    expect(result).toBe(true);
  });

  test.each([0, 10, 1.5, null, "1"])(
    "1〜9以外の値を数字として拒否すること: %s",
    (value) => {
      const result = isNanpureDigit(value);

      expect(result).toBe(false);
    },
  );
});

test("セル番号から行・列・ブロックを算出できること", () => {
  const cellIndex = 50;

  const row = getNanpureRowIndex(cellIndex);
  const column = getNanpureColumnIndex(cellIndex);
  const block = getNanpureBlockIndex(cellIndex);

  expect({ row, column, block }).toEqual({ row: 5, column: 5, block: 4 });
});

test("同じ行・列・ブロックのマスを関連マスとして判定すること", () => {
  expect(areNanpureCellsRelated(0, 8)).toBe(true);
  expect(areNanpureCellsRelated(0, 72)).toBe(true);
  expect(areNanpureCellsRelated(0, 20)).toBe(true);
  expect(areNanpureCellsRelated(0, 40)).toBe(false);
});

test("81マスではない盤面を拒否すること", () => {
  const board = Array.from({ length: NANPURE_CELL_COUNT - 1 }, () => null);
  const act = () => assertNanpureBoard(board as NanpureBoard);

  expect(act).toThrow("Nanpure board must contain 81 cells");
});
