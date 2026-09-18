import { describe, expect, test } from "vitest";

import {
  assertSudokuBoard,
  getSudokuBlockIndex,
  getSudokuColumnIndex,
  getSudokuRowIndex,
  isSudokuDigit,
  SUDOKU_CELL_COUNT,
  type SudokuBoard,
} from "./state";

describe("isSudokuDigit", () => {
  test.each([1, 5, 9])("1〜9の整数を数字として受理すること: %s", (value) => {
    const result = isSudokuDigit(value);

    expect(result).toBe(true);
  });

  test.each([0, 10, 1.5, null, "1"])(
    "1〜9以外の値を数字として拒否すること: %s",
    (value) => {
      const result = isSudokuDigit(value);

      expect(result).toBe(false);
    },
  );
});

test("セル番号から行・列・ブロックを算出できること", () => {
  const cellIndex = 50;

  const row = getSudokuRowIndex(cellIndex);
  const column = getSudokuColumnIndex(cellIndex);
  const block = getSudokuBlockIndex(cellIndex);

  expect({ row, column, block }).toEqual({ row: 5, column: 5, block: 4 });
});

test("81マスではない盤面を拒否すること", () => {
  const board = Array.from({ length: SUDOKU_CELL_COUNT - 1 }, () => null);
  const act = () => assertSudokuBoard(board as SudokuBoard);

  expect(act).toThrow("Sudoku board must contain 81 cells");
});
