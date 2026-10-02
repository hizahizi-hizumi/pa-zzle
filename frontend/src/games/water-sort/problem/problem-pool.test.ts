import { createProblemId } from "@/games/problem-id";
import { waterSortDifficulties } from "@/games/water-sort/difficulty";
import {
  findWaterSortPoolEntryByProblemId,
  listWaterSortPoolEntries,
  toWaterSortPooledProblem,
} from "@/games/water-sort/problem/problem-pool";

describe("findWaterSortPoolEntryByProblemId", () => {
  const poolEntries = waterSortDifficulties.flatMap(({ id: difficulty }) =>
    listWaterSortPoolEntries(difficulty).map((entry) => ({
      difficulty,
      entry,
      problemId: createProblemId(toWaterSortPooledProblem(entry).identity),
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
        findWaterSortPoolEntryByProblemId(difficulty, problemId) !== entry,
    );

    expect(unresolvedEntries).toEqual([]);
  });

  test("別の難易度の問題IDでは引けないこと", () => {
    const found = findWaterSortPoolEntryByProblemId(
      "1",
      firstLevel2Entry?.problemId ?? "",
    );

    expect(firstLevel2Entry).toBeDefined();
    expect(found).toBeNull();
  });

  test("問題集に無い問題IDでは引けないこと", () => {
    const found = findWaterSortPoolEntryByProblemId("1", unknownProblemId);

    expect(found).toBeNull();
  });
});
