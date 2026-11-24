import { difficultyLevels, isInNumericRange } from "@/games/difficulty";
import { magicSquareLevelBoardSizes } from "@/games/magic-square/difficulty";
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

const entries = levels.flatMap((level) =>
  listMagicSquarePoolEntries(level).map((entry) => ({ level, entry })),
);

describe("listMagicSquarePoolEntries", () => {
  test("どのレベルにも500問を返すこと", () => {
    const counts = levels.map(
      (level) => listMagicSquarePoolEntries(level).length,
    );

    expect(counts).toEqual(levels.map(() => 500));
  });
});

describe("restoreMagicSquarePoolEntry", () => {
  test("どの問題も復元でき、作業の量に空きマスの数と問題集の読みの量を添えること", () => {
    const mismatched = entries.filter(({ entry }) => {
      const { problem, workload, readingWorkload } =
        restoreMagicSquarePoolEntry(entry);
      const [, stuckPlaceCount, tier3PlaceCount, stuckSweepTotal] = entry;
      return (
        workload.emptyCellCount !==
          problem.givens.cells.filter((cell) => cell === null).length ||
        readingWorkload.stuckPlaceCount !== stuckPlaceCount ||
        readingWorkload.tier3PlaceCount !== tier3PlaceCount ||
        readingWorkload.stuckSweepTotal !== stuckSweepTotal
      );
    });

    expect(mismatched).toEqual([]);
  });
});

describe("toMagicSquarePoolIdentity", () => {
  test("盤面の一辺を、そのレベルが許す大きさにすること", () => {
    const outside = entries.filter(
      ({ level, entry }) =>
        !isInNumericRange(
          toMagicSquarePoolIdentity(entry).conditions.size,
          magicSquareLevelBoardSizes[level],
        ),
    );

    expect(outside).toEqual([]);
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

  const [seed] = listMagicSquarePoolEntries("1")[0]!;

  test("盤面の一辺と最初から置いてある数の個数を返すこと", () => {
    const features = findMagicSquarePoolProblemFeatures("1", problemId!);

    expect(features).toEqual({
      size: 4,
      givenCount: seed.split(".").filter((value) => value !== "0").length,
    });
  });

  test("問題集に無い ID には null を返すこと", () => {
    const features = findMagicSquarePoolProblemFeatures("1", "unknown");

    expect(features).toBeNull();
  });
});
