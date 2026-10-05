import { difficultyLevels } from "@/games/difficulty";
import { createProblemId } from "@/games/problem-id";
import {
  findSlidePuzzlePoolEntryByProblemId,
  listSlidePuzzlePoolEntries,
  toSlidePuzzlePooledProblem,
} from "@/games/slide-puzzle/problem/problem-pool";

describe("findSlidePuzzlePoolEntryByProblemId", () => {
  const poolEntries = difficultyLevels.flatMap(({ id: difficulty }) =>
    listSlidePuzzlePoolEntries(difficulty).map((entry) => ({
      difficulty,
      entry,
      problemId: createProblemId(toSlidePuzzlePooledProblem(entry).identity),
    })),
  );

  test("問題集の全項目の問題IDが互いに異なること", () => {
    const distinctProblemIds = new Set(
      poolEntries.map(({ problemId }) => problemId),
    );

    expect(distinctProblemIds.size).toBe(poolEntries.length);
  });

  test("問題集の全項目をその難易度と問題IDで引けること", () => {
    const unresolvedEntries = poolEntries.filter(
      ({ difficulty, entry, problemId }) =>
        findSlidePuzzlePoolEntryByProblemId(difficulty, problemId) !== entry,
    );

    expect(unresolvedEntries).toEqual([]);
  });
});
