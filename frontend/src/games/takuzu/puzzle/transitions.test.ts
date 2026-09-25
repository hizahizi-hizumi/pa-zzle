import { parseTakuzuBoard } from "@/games/takuzu/puzzle/board";
import {
  getNextTakuzuCell,
  placeTakuzuCell,
} from "@/games/takuzu/puzzle/transitions";

describe("getNextTakuzuCell", () => {
  const cases = [
    [null, "forward", "a"],
    ["a", "forward", "b"],
    ["b", "forward", null],
    [null, "backward", "b"],
    ["b", "backward", "a"],
    ["a", "backward", null],
  ] as const;

  test.each(cases)(
    "%s から %s で %s へ巡回すること",
    (cell, direction, expected) => {
      const result = getNextTakuzuCell(cell, direction);

      expect(result).toBe(expected);
    },
  );
});

describe("placeTakuzuCell", () => {
  const givens = parseTakuzuBoard(["A...", "....", "....", "...."]);
  const board = parseTakuzuBoard(["AB..", "....", "....", "...."]);

  const placementCases = [
    ["空きマスへ A", 2, "a"],
    ["空きマスへ B", 2, "b"],
    ["B のマスへ A", 1, "a"],
    ["B のマスを空き", 1, null],
  ] as const;

  test.each(placementCases)(
    "%s を直接置くこと",
    (_caseName, cellIndex, cell) => {
      const result = placeTakuzuCell(givens, board, cellIndex, cell);

      expect(result.cells[cellIndex]).toBe(cell);
    },
  );

  const unchangedCases = [
    ["固定マス", 0, "b"],
    ["同じ中身のマス", 1, "b"],
    ["盤面外のマス", 16, "a"],
  ] as const;

  test.each(unchangedCases)(
    "%s は変えずに同じ盤面を返すこと",
    (_caseName, cellIndex, cell) => {
      const result = placeTakuzuCell(givens, board, cellIndex, cell);

      expect(result).toBe(board);
    },
  );
});
