// @vitest-environment node

import { slidePuzzleDifficulties } from "@/games/slide-puzzle/difficulty";
import { selectSlidePuzzleProblemForDifficulty } from "@/games/slide-puzzle/problem-selection";
import { isSolvableSlidePuzzleBoard } from "@/games/slide-puzzle/puzzle/rules";
import { calculateSlidePuzzleManhattanDistance } from "@/games/slide-puzzle/puzzle/state";

describe("selectSlidePuzzleProblemForDifficulty", () => {
  const difficulties = slidePuzzleDifficulties.map(({ id }) => id);

  test.each(difficulties)(
    "レベル %s でマンハッタン距離が 8 以上の可解な問題を返すこと",
    (difficulty) => {
      const result = selectSlidePuzzleProblemForDifficulty(
        difficulty,
        "selection-seed",
      );

      expect(
        calculateSlidePuzzleManhattanDistance(result.problem.initialBoard),
      ).toBeGreaterThanOrEqual(8);
      expect(isSolvableSlidePuzzleBoard(result.problem.initialBoard)).toBe(
        true,
      );
    },
  );

  const boardSizeCases = [
    ["1", 3],
    ["2", 4],
    ["4", 4],
    ["5", 5],
  ] as const;

  test.each(boardSizeCases)(
    "レベル %s では一辺 %i の盤面の問題を返すこと",
    (difficulty, boardSize) => {
      const result = selectSlidePuzzleProblemForDifficulty(
        difficulty,
        "size-seed",
      );

      expect(result.identity.conditions.size).toBe(boardSize);
      expect(result.problem.initialBoard).toHaveLength(boardSize * boardSize);
    },
  );

  test("同じ難易度と seed から同じ問題を返すこと", () => {
    const first = selectSlidePuzzleProblemForDifficulty("3", "same-seed");
    const second = selectSlidePuzzleProblemForDifficulty("3", "same-seed");

    expect(second).toEqual(first);
  });

  describe("最初に生成した盤面のマンハッタン距離が 8 未満の場合", () => {
    const seed = "s30";

    test("seed を変えて生成し直した盤面を返すこと", () => {
      const result = selectSlidePuzzleProblemForDifficulty("1", seed);

      expect(result.identity.seed).toBe(`${seed}-1`);
      expect(
        calculateSlidePuzzleManhattanDistance(result.problem.initialBoard),
      ).toBeGreaterThanOrEqual(8);
    });
  });
});
