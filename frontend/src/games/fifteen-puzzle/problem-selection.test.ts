// @vitest-environment node

import { fifteenPuzzleDifficulties } from "@/games/fifteen-puzzle/difficulty";
import { selectFifteenPuzzleProblemForDifficulty } from "@/games/fifteen-puzzle/problem-selection";
import { isSolvableFifteenPuzzleBoard } from "@/games/fifteen-puzzle/puzzle/rules";
import { isFifteenPuzzleSolved } from "@/games/fifteen-puzzle/puzzle/state";

describe("selectFifteenPuzzleProblemForDifficulty", () => {
  const difficulties = fifteenPuzzleDifficulties.map(({ id }) => id);

  test.each(difficulties)(
    "レベル %s で未完成かつ可解な問題を返すこと",
    (difficulty) => {
      const result = selectFifteenPuzzleProblemForDifficulty(
        difficulty,
        "selection-seed",
      );

      expect(isFifteenPuzzleSolved(result.problem.initialBoard)).toBe(false);
      expect(isSolvableFifteenPuzzleBoard(result.problem.initialBoard)).toBe(
        true,
      );
    },
  );

  test("同じ難易度と seed から同じ問題を返すこと", () => {
    const first = selectFifteenPuzzleProblemForDifficulty("3", "same-seed");
    const second = selectFifteenPuzzleProblemForDifficulty("3", "same-seed");

    expect(second).toEqual(first);
  });
});
