import { createProblemId } from "@/games/problem-id";
import { slidePuzzleDifficulties } from "@/games/slide-puzzle/difficulty";
import {
  findSlidePuzzlePoolEntryByProblemId,
  listSlidePuzzlePoolEntries,
  toSlidePuzzlePooledProblem,
} from "@/games/slide-puzzle/problem/problem-pool";

describe("findSlidePuzzlePoolEntryByProblemId", () => {
  const poolEntries = slidePuzzleDifficulties.flatMap(({ id: difficulty }) =>
    listSlidePuzzlePoolEntries(difficulty).map((entry) => ({
      difficulty,
      entry,
      problemId: createProblemId(toSlidePuzzlePooledProblem(entry).identity),
    })),
  );
  const firstLevel2Entry = poolEntries.find(
    ({ difficulty }) => difficulty === "2",
  );
  const unknownProblemId = "0000000000";

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

  test("別の難易度の問題IDでは引けないこと", () => {
    const found = findSlidePuzzlePoolEntryByProblemId(
      "1",
      firstLevel2Entry?.problemId ?? "",
    );

    expect(firstLevel2Entry).toBeDefined();
    expect(found).toBeNull();
  });

  test("問題集に無い問題IDでは引けないこと", () => {
    const found = findSlidePuzzlePoolEntryByProblemId("1", unknownProblemId);

    expect(found).toBeNull();
  });
});
