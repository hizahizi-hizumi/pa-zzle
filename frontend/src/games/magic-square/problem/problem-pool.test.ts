import { difficultyLevels } from "@/games/difficulty";
import {
  findMagicSquarePoolEntryByProblemId,
  findMagicSquarePoolProblemFeatures,
  listMagicSquarePoolEntries,
  listMagicSquarePoolProblemIds,
  restoreMagicSquarePoolEntry,
  toMagicSquarePoolIdentity,
} from "@/games/magic-square/problem/problem-pool";
import { createProblemId } from "@/games/problem-id";

const levels = difficultyLevels.map(({ id }) => id);

describe("問題集", () => {
  const entries = levels.flatMap((level) =>
    listMagicSquarePoolEntries(level).map((entry) => ({ level, entry })),
  );

  test("どのレベルにも問題があること", () => {
    const counts = levels.map(
      (level) => listMagicSquarePoolEntries(level).length,
    );

    expect(counts.every((count) => count > 0)).toBe(true);
  });

  test("どの問題も復元でき、作業の量に空きマスの数を添えること", () => {
    const restored = entries.map(({ entry }) => {
      const { problem, workload } = restoreMagicSquarePoolEntry(entry);
      return (
        workload.emptyCellCount ===
        problem.givens.cells.filter((cell) => cell === null).length
      );
    });

    expect(restored.every(Boolean)).toBe(true);
  });

  test("盤面の一辺は 4・5・6 のどれかであること", () => {
    const sizes = new Set(
      entries.map(
        ({ entry }) => toMagicSquarePoolIdentity(entry).conditions.size,
      ),
    );

    expect([...sizes].sort()).toEqual([4, 5, 6]);
  });
});

describe("listMagicSquarePoolProblemIds", () => {
  test("全レベルの問題 ID を重なりなく返すこと", () => {
    const problemIds = levels.flatMap((level) =>
      listMagicSquarePoolProblemIds(level),
    );

    expect(new Set(problemIds).size).toBe(problemIds.length);
  });

  test("問題集の並び順で、項目の identity から求めた ID を返すこと", () => {
    const problemIds = listMagicSquarePoolProblemIds("2");

    expect(problemIds).toEqual(
      listMagicSquarePoolEntries("2").map((entry) =>
        createProblemId(toMagicSquarePoolIdentity(entry)),
      ),
    );
  });
});

describe("findMagicSquarePoolEntryByProblemId", () => {
  const [problemId] = listMagicSquarePoolProblemIds("3");

  test("そのレベルの問題 ID から問題集の項目を引くこと", () => {
    const entry = findMagicSquarePoolEntryByProblemId("3", problemId!);

    expect(entry).toBe(listMagicSquarePoolEntries("3")[0]);
  });

  test("別のレベルの問題 ID には null を返すこと", () => {
    const entry = findMagicSquarePoolEntryByProblemId("4", problemId!);

    expect(entry).toBeNull();
  });
});

describe("findMagicSquarePoolProblemFeatures", () => {
  const [problemId] = listMagicSquarePoolProblemIds("1");

  test("盤面の一辺と最初から置いてある数の個数を返すこと", () => {
    const features = findMagicSquarePoolProblemFeatures("1", problemId!);

    expect(features).toEqual({ size: 4, givenCount: 8 });
  });

  test("問題集に無い ID には null を返すこと", () => {
    const features = findMagicSquarePoolProblemFeatures("1", "unknown");

    expect(features).toBeNull();
  });
});
