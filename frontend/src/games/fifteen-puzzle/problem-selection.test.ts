// @vitest-environment node

import { fifteenPuzzleDifficulties } from "@/games/fifteen-puzzle/difficulty";
import { selectFifteenPuzzleProblemForDifficulty } from "@/games/fifteen-puzzle/problem-selection";
import { isSolvableFifteenPuzzleBoard } from "@/games/fifteen-puzzle/puzzle/rules";
import { calculateFifteenPuzzleManhattanDistance } from "@/games/fifteen-puzzle/puzzle/state";

describe("selectFifteenPuzzleProblemForDifficulty", () => {
  const difficulties = fifteenPuzzleDifficulties.map(({ id }) => id);

  test.each(difficulties)(
    "レベル %s でマンハッタン距離が 8 以上の可解な問題を返すこと",
    (difficulty) => {
      const result = selectFifteenPuzzleProblemForDifficulty(
        difficulty,
        "selection-seed",
      );

      expect(
        calculateFifteenPuzzleManhattanDistance(result.problem.initialBoard),
      ).toBeGreaterThanOrEqual(8);
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

  describe("最初に生成した盤面のマンハッタン距離が 8 未満の場合", () => {
    const seed = "s235";

    test("seed を変えて生成し直した盤面を返すこと", () => {
      const result = selectFifteenPuzzleProblemForDifficulty("1", seed);

      expect(result.identity.seed).toBe(`${seed}-1`);
      expect(
        calculateFifteenPuzzleManhattanDistance(result.problem.initialBoard),
      ).toBeGreaterThanOrEqual(8);
    });
  });
});
