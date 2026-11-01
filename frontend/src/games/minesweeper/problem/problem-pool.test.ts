import { difficultyLevels } from "@/games/difficulty";
import {
  findMinesweeperPoolEntryByProblemId,
  findMinesweeperPoolProblemFeatures,
  listMinesweeperPoolEntries,
  toMinesweeperPoolIdentity,
} from "@/games/minesweeper/problem/problem-pool";
import { createProblemId } from "@/games/problem-id";

describe("findMinesweeperPoolEntryByProblemId", () => {
  const poolEntries = difficultyLevels.flatMap(({ id: difficulty }) =>
    listMinesweeperPoolEntries(difficulty).map((entry) => ({
      difficulty,
      entry,
      problemId: createProblemId(toMinesweeperPoolIdentity(difficulty, entry)),
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
        findMinesweeperPoolEntryByProblemId(difficulty, problemId) !== entry,
    );

    expect(unresolvedEntries).toEqual([]);
  });
});

describe("findMinesweeperPoolProblemFeatures", () => {
  const [entry] = listMinesweeperPoolEntries("3");
  if (!entry) {
    throw new Error("No level 3 minesweeper pool entry");
  }
  const problemId = createProblemId(toMinesweeperPoolIdentity("3", entry));

  test("問題集の1問の特徴を、項目の盤面の行数・列数と地雷の数で返すこと", () => {
    const features = findMinesweeperPoolProblemFeatures("3", problemId);

    expect(features).toEqual({
      rows: entry[0],
      columns: entry[1],
      mineCount: entry[2],
    });
  });

  test("問題集に無い ID と、別の難易度の ID には null を返すこと", () => {
    const unknown = findMinesweeperPoolProblemFeatures("3", "unknown");
    const otherDifficulty = findMinesweeperPoolProblemFeatures("1", problemId);

    expect(unknown).toBeNull();
    expect(otherDifficulty).toBeNull();
  });
});
