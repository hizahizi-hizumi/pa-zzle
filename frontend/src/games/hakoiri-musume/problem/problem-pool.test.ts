import { difficultyLevels } from "@/games/difficulty";
import { measureHakoiriMusumeOptimalMoveCount } from "@/games/hakoiri-musume/problem/generation/shortest-solution";
import {
  decodeHakoiriMusumePoolEntry,
  findHakoiriMusumePoolEntryByProblemId,
  listHakoiriMusumePoolEntries,
  restoreHakoiriMusumePoolEntry,
} from "@/games/hakoiri-musume/problem/problem-pool";
import { createProblemId } from "@/games/problem-id";

const poolEntries = difficultyLevels.flatMap(({ id: difficulty }) =>
  listHakoiriMusumePoolEntries(difficulty).map((entry) => ({
    difficulty,
    entry,
    problemId: createProblemId(decodeHakoiriMusumePoolEntry(entry).identity),
  })),
);

describe("restoreHakoiriMusumePoolEntry", () => {
  test("全項目の盤面を問題として読み、最短手数が解き直した手数と一致すること", () => {
    const mismatches = poolEntries.filter(({ entry }) => {
      const { problem, optimalMoveCount } =
        restoreHakoiriMusumePoolEntry(entry);
      return (
        measureHakoiriMusumeOptimalMoveCount(problem.pieces) !==
        optimalMoveCount
      );
    });

    expect(mismatches).toEqual([]);
  });
});

describe("findHakoiriMusumePoolEntryByProblemId", () => {
  const firstLevelOneEntry = poolEntries.find(
    ({ difficulty }) => difficulty === "1",
  )!;

  test("問題集の全項目の問題IDが互いに異なること", () => {
    const distinctProblemIds = new Set(
      poolEntries.map(({ problemId }) => problemId),
    );

    expect(distinctProblemIds.size).toBe(poolEntries.length);
  });

  test("問題集の全項目をその難易度と問題IDで引けること", () => {
    const unresolvedEntries = poolEntries.filter(
      ({ difficulty, entry, problemId }) =>
        findHakoiriMusumePoolEntryByProblemId(difficulty, problemId) !== entry,
    );

    expect(unresolvedEntries).toEqual([]);
  });

  test("別の難易度の問題IDには null を返すこと", () => {
    const entry = findHakoiriMusumePoolEntryByProblemId(
      "2",
      firstLevelOneEntry.problemId,
    );

    expect(entry).toBeNull();
  });
});
