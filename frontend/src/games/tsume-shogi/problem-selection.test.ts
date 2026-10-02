import { createTsumeShogiProblemIdentity } from "@/games/tsume-shogi/problem/problem";
import { listTsumeShogiProvisionalProblems } from "@/games/tsume-shogi/problem/provisional-problems";
import {
  restoreTsumeShogiProblem,
  selectTsumeShogiProblemForDifficulty,
} from "@/games/tsume-shogi/problem-selection";

const provisionalSeeds = listTsumeShogiProvisionalProblems().map(
  ({ identity }) => identity.seed,
);

describe("selectTsumeShogiProblemForDifficulty", () => {
  const seed = "fixed-seed";

  test("同じ seed から同じ仮の問題を選ぶこと", () => {
    const first = selectTsumeShogiProblemForDifficulty("1", seed);
    const second = selectTsumeShogiProblemForDifficulty("1", seed);

    expect(provisionalSeeds).toContain(first.identity.seed);
    expect(second.identity).toEqual(first.identity);
  });
});

describe("restoreTsumeShogiProblem", () => {
  const provisionalIdentity = createTsumeShogiProblemIdentity(5, 3);
  const unknownIdentity = createTsumeShogiProblemIdentity(5, 999);

  test("仮の問題の identity からその問題を返すこと", () => {
    const restored = restoreTsumeShogiProblem(provisionalIdentity);

    expect(restored?.identity).toEqual(provisionalIdentity);
  });

  test("出題できる問題に無い identity は null を返すこと", () => {
    const restored = restoreTsumeShogiProblem(unknownIdentity);

    expect(restored).toBeNull();
  });
});
