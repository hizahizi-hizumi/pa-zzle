// @vitest-environment node

import {
  assessFifteenPuzzleDifficulty,
  fifteenPuzzleDifficulties,
} from "@/games/fifteen-puzzle/difficulty";
import { analyzeFifteenPuzzleDifficulty } from "@/games/fifteen-puzzle/problem/difficulty-analysis";
import { solveFifteenPuzzleOptimally } from "@/games/fifteen-puzzle/problem/generation/solver";
import { generateFifteenPuzzleBoard } from "@/games/fifteen-puzzle/problem/generator";
import type { FifteenPuzzleProblemIdentity } from "@/games/fifteen-puzzle/problem/problem";
import {
  listFifteenPuzzlePoolEntries,
  toFifteenPuzzlePooledProblem,
} from "@/games/fifteen-puzzle/problem/problem-pool";
import {
  restoreFifteenPuzzlePooledProblem,
  selectFifteenPuzzleProblemForDifficulty,
} from "@/games/fifteen-puzzle/problem-selection";
import { isSolvableFifteenPuzzleBoard } from "@/games/fifteen-puzzle/puzzle/rules";

const difficulties = fifteenPuzzleDifficulties.map(({ id }) => id);

describe("問題集", () => {
  test.each(difficulties)(
    "レベル %s の全問題が可解で、保存した最短手数からそのレベルと判定されること",
    (difficulty) => {
      const levels = listFifteenPuzzlePoolEntries(difficulty).map((entry) => {
        const { identity, optimalMoveCount } =
          toFifteenPuzzlePooledProblem(entry);
        const board = generateFifteenPuzzleBoard(
          identity.seed,
          identity.conditions,
        );
        return isSolvableFifteenPuzzleBoard(board)
          ? assessFifteenPuzzleDifficulty(
              analyzeFifteenPuzzleDifficulty(board, optimalMoveCount),
            )
          : null;
      });

      expect(levels.length).toBeGreaterThanOrEqual(100);
      expect(new Set(levels)).toEqual(new Set([difficulty]));
    },
  );

  // 最短手数の保存値を solver で確かめる。重い盤面はテストで解かず、短い問題だけを見る。
  const shortCases = listFifteenPuzzlePoolEntries("1")
    .slice(0, 10)
    .map(
      ([seed, scrambleLength, optimalMoveCount]) =>
        [
          seed,
          generateFifteenPuzzleBoard(seed, { size: 4, scrambleLength }),
          optimalMoveCount,
        ] as const,
    );

  test.each(shortCases)(
    "レベル 1 の %s は保存した最短手数を solver で再現できること",
    (_seed, board, optimalMoveCount) => {
      const result = solveFifteenPuzzleOptimally(board);

      expect(result).toMatchObject({ status: "solved", optimalMoveCount });
    },
  );
});

describe("selectFifteenPuzzleProblemForDifficulty", () => {
  test.each(difficulties)(
    "レベル %s の問題集から同じ seed で同じ問題を選ぶこと",
    (difficulty) => {
      const first = selectFifteenPuzzleProblemForDifficulty(
        difficulty,
        "seed-a",
      );
      const second = selectFifteenPuzzleProblemForDifficulty(
        difficulty,
        "seed-a",
      );

      expect(second).toEqual(first);
      expect(
        listFifteenPuzzlePoolEntries(difficulty).some(
          ([seed, scrambleLength, optimalMoveCount]) =>
            seed === first.identity.seed &&
            scrambleLength === first.identity.conditions.scrambleLength &&
            optimalMoveCount === first.optimalMoveCount,
        ),
      ).toBe(true);
    },
  );
});

describe("restoreFifteenPuzzlePooledProblem", () => {
  const pooledProblems = listFifteenPuzzlePoolEntries("3")
    .slice(0, 3)
    .map((entry) => [entry[0], toFifteenPuzzlePooledProblem(entry)] as const);
  const unknownIdentity: FifteenPuzzleProblemIdentity = {
    generatorVersion: "1",
    seed: "not-in-pool",
    conditions: { size: 4, scrambleLength: 30 },
  };

  test.each(pooledProblems)(
    "問題集にある識別情報から盤面と最短手数を復元すること: %s",
    (_seed, { identity, optimalMoveCount }) => {
      const result = restoreFifteenPuzzlePooledProblem(identity);

      expect(result).toEqual({
        problem: {
          initialBoard: generateFifteenPuzzleBoard(
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
    const result = restoreFifteenPuzzlePooledProblem(unknownIdentity);

    expect(result).toBeNull();
  });
});
