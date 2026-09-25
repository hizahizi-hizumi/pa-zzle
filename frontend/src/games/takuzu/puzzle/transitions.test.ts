import { parseTakuzuBoard } from "@/games/takuzu/puzzle/board";
import {
  cycleTakuzuCell,
  getNextTakuzuCell,
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

describe("cycleTakuzuCell", () => {
  const givens = parseTakuzuBoard(["A...", "....", "....", "...."]);

  test("空きマスを次のタイルへ変えること", () => {
    const result = cycleTakuzuCell(givens, givens, 1, "forward");

    expect(result.cells[1]).toBe("a");
    expect(givens.cells[1]).toBeNull();
  });

  test("固定マスを変えずに同じ盤面を返すこと", () => {
    const result = cycleTakuzuCell(givens, givens, 0, "forward");

    expect(result).toBe(givens);
  });

  test("盤面外のマスを変えずに同じ盤面を返すこと", () => {
    const result = cycleTakuzuCell(givens, givens, 16, "forward");

    expect(result).toBe(givens);
  });
});
