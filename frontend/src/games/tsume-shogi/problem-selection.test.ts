import { tsumeShogiDifficulties } from "@/games/tsume-shogi/difficulty";
import { createTsumeShogiProblemIdentity } from "@/games/tsume-shogi/problem/problem";
import { toTsumeShogiPooledProblem } from "@/games/tsume-shogi/problem/problem-pool";
import {
  restoreTsumeShogiProblem,
  selectTsumeShogiProblemForDifficulty,
} from "@/games/tsume-shogi/problem-selection";

describe("selectTsumeShogiProblemForDifficulty", () => {
  const seed = "fixed-seed";
  const difficulties = tsumeShogiDifficulties.map(({ id }) => id);

  test.each(difficulties)(
    "レベル %s の問題集から、同じ seed で同じ問題を選ぶこと",
    (difficulty) => {
      const first = selectTsumeShogiProblemForDifficulty(difficulty, seed);
      const second = selectTsumeShogiProblemForDifficulty(difficulty, seed);

      expect(first.poolReference.problemId).toMatch(
        new RegExp(`^${difficulty}-\\d+$`),
      );
      expect(second).toEqual(first);
    },
  );
});

describe("restoreTsumeShogiProblem", () => {
  const pooled = toTsumeShogiPooledProblem("2", 0);
  const unknownIdentity = createTsumeShogiProblemIdentity(5, 999_999, {
    minimum: 1,
    maximum: 4,
  });

  test("問題集の identity からその問題を返すこと", () => {
    const restored = restoreTsumeShogiProblem(pooled.identity);

    expect(restored).toEqual(pooled);
  });

  test("問題集に無い identity は null を返すこと", () => {
    const restored = restoreTsumeShogiProblem(unknownIdentity);

    expect(restored).toBeNull();
  });
});
