import { difficultyLevels } from "@/games/difficulty";
import { createProblemId } from "@/games/problem-id";
import {
  decodeWaterSortPoolEntry,
  findWaterSortPoolEntryByProblemId,
  findWaterSortPoolProblemFeatures,
  listWaterSortPoolEntries,
} from "@/games/water-sort/problem/problem-pool";

describe("findWaterSortPoolEntryByProblemId", () => {
  const poolEntries = difficultyLevels.flatMap(({ id: difficulty }) =>
    listWaterSortPoolEntries(difficulty).map((entry) => ({
      difficulty,
      entry,
      problemId: createProblemId(decodeWaterSortPoolEntry(entry).identity),
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
        findWaterSortPoolEntryByProblemId(difficulty, problemId) !== entry,
    );

    expect(unresolvedEntries).toEqual([]);
  });
});

describe("findWaterSortPoolProblemFeatures", () => {
  const [entry] = listWaterSortPoolEntries("3");
  if (!entry) {
    throw new Error("No level 3 water sort pool entry");
  }
  const problemId = createProblemId(decodeWaterSortPoolEntry(entry).identity);

  test("問題集の1問の特徴を、項目の色数と空ボトルの数で返すこと", () => {
    const features = findWaterSortPoolProblemFeatures("3", problemId);

    expect(features).toEqual({
      colorCount: entry[1],
      emptyBottleCount: entry[2],
    });
  });

  test("問題集に無い ID と、別の難易度の ID には null を返すこと", () => {
    const unknown = findWaterSortPoolProblemFeatures("3", "unknown");
    const otherDifficulty = findWaterSortPoolProblemFeatures("1", problemId);

    expect(unknown).toBeNull();
    expect(otherDifficulty).toBeNull();
  });
});
