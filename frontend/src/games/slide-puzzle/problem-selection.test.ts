// @vitest-environment node

import {
  assessSlidePuzzleDifficulty,
  slidePuzzleDifficulties,
} from "@/games/slide-puzzle/difficulty";
import { analyzeSlidePuzzleDifficulty } from "@/games/slide-puzzle/problem/difficulty-analysis";
import { solveSlidePuzzleOptimally } from "@/games/slide-puzzle/problem/generation/solver";
import { generateSlidePuzzleBoard } from "@/games/slide-puzzle/problem/generator";
import type { SlidePuzzleProblemIdentity } from "@/games/slide-puzzle/problem/problem";
import {
  listSlidePuzzlePoolEntries,
  toSlidePuzzlePooledProblem,
} from "@/games/slide-puzzle/problem/problem-pool";
import {
  restoreSlidePuzzlePooledProblem,
  selectSlidePuzzleProblemForDifficulty,
} from "@/games/slide-puzzle/problem-selection";
import { isSolvableSlidePuzzleBoard } from "@/games/slide-puzzle/puzzle/rules";

const difficulties = slidePuzzleDifficulties.map(({ id }) => id);

describe("問題集", () => {
  test.each(difficulties)(
    "レベル %s の全問題が可解で、保存した最短手数からそのレベルと判定されること",
    (difficulty) => {
      const levels = listSlidePuzzlePoolEntries(difficulty).map((entry) => {
        const { identity, optimalMoveCount } =
          toSlidePuzzlePooledProblem(entry);
        const board = generateSlidePuzzleBoard(
          identity.seed,
          identity.conditions,
        );
        return isSolvableSlidePuzzleBoard(board)
          ? assessSlidePuzzleDifficulty(
              analyzeSlidePuzzleDifficulty(board, optimalMoveCount),
            )
          : null;
      });

      expect(levels.length).toBeGreaterThanOrEqual(100);
      expect(new Set(levels)).toEqual(new Set([difficulty]));
    },
  );

  // 最短手数の保存値を solver で確かめる。重い盤面はテストで解かず、短い問題だけを見る。
  const shortCases = listSlidePuzzlePoolEntries("1")
    .slice(0, 10)
    .map(
      ([seed, scrambleLength, optimalMoveCount]) =>
        [
          seed,
          generateSlidePuzzleBoard(seed, { size: 4, scrambleLength }),
          optimalMoveCount,
        ] as const,
    );

  test.each(shortCases)(
    "レベル 1 の %s は保存した最短手数を solver で再現できること",
    (_seed, board, optimalMoveCount) => {
      const result = solveSlidePuzzleOptimally(board);

      expect(result).toMatchObject({ status: "solved", optimalMoveCount });
    },
  );
});

describe("selectSlidePuzzleProblemForDifficulty", () => {
  test.each(difficulties)(
    "レベル %s の問題集から同じ seed で同じ問題を選ぶこと",
    (difficulty) => {
      const first = selectSlidePuzzleProblemForDifficulty(difficulty, "seed-a");
      const second = selectSlidePuzzleProblemForDifficulty(
        difficulty,
        "seed-a",
      );

      expect(second).toEqual(first);
      expect(
        listSlidePuzzlePoolEntries(difficulty).some(
          ([seed, scrambleLength, optimalMoveCount]) =>
            seed === first.identity.seed &&
            scrambleLength === first.identity.conditions.scrambleLength &&
            optimalMoveCount === first.optimalMoveCount,
        ),
      ).toBe(true);
    },
  );
});

describe("restoreSlidePuzzlePooledProblem", () => {
  const pooledProblems = listSlidePuzzlePoolEntries("3")
    .slice(0, 3)
    .map((entry) => [entry[0], toSlidePuzzlePooledProblem(entry)] as const);
  const unknownIdentity: SlidePuzzleProblemIdentity = {
    generatorVersion: "1",
    seed: "not-in-pool",
    conditions: { size: 4, scrambleLength: 30 },
  };

  test.each(pooledProblems)(
    "問題集にある識別情報から盤面と最短手数を復元すること: %s",
    (_seed, { identity, optimalMoveCount }) => {
      const result = restoreSlidePuzzlePooledProblem(identity);

      expect(result).toEqual({
        problem: {
          initialBoard: generateSlidePuzzleBoard(
            identity.seed,
            identity.conditions,
          ),
        },
        identity,
        optimalMoveCount,
      });
    },
  );

  test("問題集に無い識別情報では null を返すこと", () => {
    const result = restoreSlidePuzzlePooledProblem(unknownIdentity);

    expect(result).toBeNull();
  });
});
