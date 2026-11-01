import { difficultyLevels } from "@/games/difficulty";
import { createProblemId } from "@/games/problem-id";
import {
  decodeSlidePuzzlePoolEntry,
  findSlidePuzzlePoolEntryByProblemId,
  findSlidePuzzlePoolProblemFeatures,
  listSlidePuzzlePoolEntries,
} from "@/games/slide-puzzle/problem/problem-pool";

describe("findSlidePuzzlePoolEntryByProblemId", () => {
  const poolEntries = difficultyLevels.flatMap(({ id: difficulty }) =>
    listSlidePuzzlePoolEntries(difficulty).map((entry) => ({
      difficulty,
      entry,
      problemId: createProblemId(decodeSlidePuzzlePoolEntry(entry).identity),
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

describe("findSlidePuzzlePoolProblemFeatures", () => {
  const [entry] = listSlidePuzzlePoolEntries("3");
  if (!entry) {
    throw new Error("No level 3 slide puzzle pool entry");
  }
  const problemId = createProblemId(decodeSlidePuzzlePoolEntry(entry).identity);

  test("問題集の1問の特徴を、項目の盤面の大きさで返すこと", () => {
    const features = findSlidePuzzlePoolProblemFeatures("3", problemId);

    expect(features).toEqual({ boardSize: entry[1] });
  });

  test("問題集に無い ID と、別の難易度の ID には null を返すこと", () => {
    const unknown = findSlidePuzzlePoolProblemFeatures("3", "unknown");
    const otherDifficulty = findSlidePuzzlePoolProblemFeatures("1", problemId);

    expect(unknown).toBeNull();
    expect(otherDifficulty).toBeNull();
  });
});
