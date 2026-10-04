import { createProblemId } from "@/games/problem-id";
import { tsumeShogiDifficulties } from "@/games/tsume-shogi/difficulty";
import { createTsumeShogiProblemIdentity } from "@/games/tsume-shogi/problem/problem";
import { toTsumeShogiPooledProblem } from "@/games/tsume-shogi/problem/problem-pool";
import {
  canSelectTsumeShogiProblemById,
  restoreTsumeShogiProblem,
  selectTsumeShogiProblemById,
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

describe("selectTsumeShogiProblemById", () => {
  const pooled = toTsumeShogiPooledProblem("3", 4);
  const problemId = createProblemId(pooled.identity);

  test("難易度の問題集から問題IDでその問題を引くこと", () => {
    const selected = selectTsumeShogiProblemById("3", problemId);

    expect(selected).toEqual(pooled);
  });

  test("別の難易度の問題IDは引かないこと", () => {
    const selected = selectTsumeShogiProblemById("2", problemId);

    expect(selected).toBeNull();
  });
});

describe("canSelectTsumeShogiProblemById", () => {
  const problemId = createProblemId(toTsumeShogiPooledProblem("4", 0).identity);
  const cases = [
    ["その難易度の問題集にある", "4", problemId, true],
    ["別の難易度の", "5", problemId, false],
    ["問題集に無い", "4", "0000000000", false],
  ] as const;

  test.each(cases)(
    "%s問題IDを引けるか確かめること",
    (_, difficulty, requestedProblemId, expected) => {
      const result = canSelectTsumeShogiProblemById(
        difficulty,
        requestedProblemId,
      );

      expect(result).toBe(expected);
    },
  );
});
