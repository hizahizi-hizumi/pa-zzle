import { minesweeperDifficulties } from "@/games/minesweeper/difficulty";
import {
  findMinesweeperPoolEntryByProblemId,
  listMinesweeperPoolEntries,
  toMinesweeperPoolIdentity,
} from "@/games/minesweeper/problem/problem-pool";
import { createProblemId } from "@/games/problem-id";

describe("findMinesweeperPoolEntryByProblemId", () => {
  const poolEntries = minesweeperDifficulties.flatMap(({ id: difficulty }) =>
    listMinesweeperPoolEntries(difficulty).map((entry) => ({
      difficulty,
      entry,
      problemId: createProblemId(toMinesweeperPoolIdentity(difficulty, entry)),
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
        findMinesweeperPoolEntryByProblemId(difficulty, problemId) !== entry,
    );

    expect(unresolvedEntries).toEqual([]);
  });

  test("別の難易度の問題IDでは引けないこと", () => {
    const found = findMinesweeperPoolEntryByProblemId(
      "1",
      firstLevel2Entry?.problemId ?? "",
    );

    expect(firstLevel2Entry).toBeDefined();
    expect(found).toBeNull();
  });

  test("問題集に無い問題IDでは引けないこと", () => {
    const found = findMinesweeperPoolEntryByProblemId("1", unknownProblemId);

    expect(found).toBeNull();
  });
});
