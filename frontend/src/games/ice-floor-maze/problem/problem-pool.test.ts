import { difficultyLevels } from "@/games/difficulty";
import {
  decodeIceFloorMazePoolEntry,
  findIceFloorMazePoolEntryByProblemId,
  type IceFloorMazeProblemPoolEntry,
  listIceFloorMazePoolEntries,
  restoreIceFloorMazePoolEntry,
} from "@/games/ice-floor-maze/problem/problem-pool";
import { createProblemId } from "@/games/problem-id";

describe("decodeIceFloorMazePoolEntry", () => {
  const entry: IceFloorMazeProblemPoolEntry = [
    "50000000000000000000000000000000-9-63",
    8,
    8,
    4,
  ];

  test("seed と盤面の形から今の生成器の identity を作り、最少手数を添えること", () => {
    const decoded = decodeIceFloorMazePoolEntry(entry);

    expect(decoded).toEqual({
      identity: {
        generatorVersion: "2",
        seed: "50000000000000000000000000000000-9-63",
        conditions: { width: 8, height: 8 },
      },
      optimalMoveCount: 4,
    });
  });
});

describe("restoreIceFloorMazePoolEntry", () => {
  const entry = listIceFloorMazePoolEntries("3")[0]!;

  test("identity から盤面・開始位置・ゴールを復号し、最少手数を添えること", () => {
    const pooled = restoreIceFloorMazePoolEntry(entry);

    expect(pooled.identity.seed).toBe(entry[0]);
    expect(pooled.problem.board).toMatchObject({
      width: entry[1],
      height: entry[2],
    });
    expect(pooled.optimalMoveCount).toBe(entry[3]);
  });
});

describe("findIceFloorMazePoolEntryByProblemId", () => {
  const poolEntries = difficultyLevels.flatMap(({ id: difficulty }) =>
    listIceFloorMazePoolEntries(difficulty).map((entry) => ({
      difficulty,
      entry,
      problemId: createProblemId(decodeIceFloorMazePoolEntry(entry).identity),
    })),
  );
  const firstLevelOneEntry = poolEntries[0]!;

  test("問題集の全項目の問題IDが互いに異なること", () => {
    const distinctProblemIds = new Set(
      poolEntries.map(({ problemId }) => problemId),
    );

    expect(distinctProblemIds.size).toBe(poolEntries.length);
  });

  test("問題集の全項目をその難易度と問題IDで引けること", () => {
    const unresolvedEntries = poolEntries.filter(
      ({ difficulty, entry, problemId }) =>
        findIceFloorMazePoolEntryByProblemId(difficulty, problemId) !== entry,
    );

    expect(unresolvedEntries).toEqual([]);
  });

  test("別の難易度の問題IDには null を返すこと", () => {
    const entry = findIceFloorMazePoolEntryByProblemId(
      "2",
      firstLevelOneEntry.problemId,
    );

    expect(entry).toBeNull();
  });
});
