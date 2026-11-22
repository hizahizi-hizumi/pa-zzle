import { parseMagicSquareBoard } from "@/games/magic-square/puzzle/board";
import { toggleMagicSquareMemo } from "@/games/magic-square/puzzle/rules";
import {
  createMagicSquareInitialState,
  isSameMagicSquareState,
} from "@/games/magic-square/puzzle/state";

const givens = parseMagicSquareBoard([
  ". 4 5 .",
  ". 2 . .",
  ". . 12 1",
  "3 . 10 6",
]);

describe("createMagicSquareInitialState", () => {
  test("最初から置いてある数の盤面と、空のメモで始めること", () => {
    const state = createMagicSquareInitialState(givens);

    expect(state).toEqual({
      size: 4,
      cells: givens.cells,
      memos: givens.cells.map(() => []),
    });
  });
});

describe("isSameMagicSquareState", () => {
  const initial = createMagicSquareInitialState(givens);
  const memoed = toggleMagicSquareMemo(givens, initial, 0, 7);

  test("作り直した同じ状態を同じとすること", () => {
    const same = isSameMagicSquareState(
      initial,
      createMagicSquareInitialState(givens),
    );

    expect(same).toBe(true);
  });

  test("メモだけが違う状態を違うとすること", () => {
    const same = isSameMagicSquareState(initial, memoed);

    expect(same).toBe(false);
  });
});
