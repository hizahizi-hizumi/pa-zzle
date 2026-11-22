import {
  listMagicSquarePoolEntries,
  listMagicSquarePoolProblemIds,
} from "@/games/magic-square/problem/problem-pool";
import {
  canSelectMagicSquareProblemById,
  selectMagicSquareProblemById,
  selectMagicSquareProblemForDifficulty,
} from "@/games/magic-square/problem-selection";
import { createProblemId } from "@/games/problem-id";

describe("selectMagicSquareProblemForDifficulty", () => {
  const seeds = Array.from({ length: 20 }, (_, index) => `seed-${index}`);

  test("そのレベルの問題集から問題を選ぶこと", () => {
    const problemIds = seeds.map((seed) =>
      createProblemId(
        selectMagicSquareProblemForDifficulty("2", seed).identity,
      ),
    );

    expect(
      problemIds.every((problemId) =>
        listMagicSquarePoolProblemIds("2").includes(problemId),
      ),
    ).toBe(true);
  });

  test("同じ seed から同じ問題を選ぶこと", () => {
    const [first, second] = [0, 1].map(
      () => selectMagicSquareProblemForDifficulty("5", "same").identity,
    );

    expect(second).toEqual(first);
  });
});

describe("selectMagicSquareProblemById", () => {
  const [problemId] = listMagicSquarePoolProblemIds("4");

  test("問題 ID の問題を問題集から復元すること", () => {
    const selected = selectMagicSquareProblemById("4", problemId!);

    expect(selected?.identity.seed).toBe(listMagicSquarePoolEntries("4")[0]);
  });

  test("別のレベルの問題 ID には null を返すこと", () => {
    const selected = selectMagicSquareProblemById("1", problemId!);

    expect(selected).toBeNull();
  });
});

describe("canSelectMagicSquareProblemById", () => {
  const [problemId] = listMagicSquarePoolProblemIds("4");
  const cases = [
    ["4", problemId!, true],
    ["1", problemId!, false],
    ["4", "unknown", false],
  ] as const;

  test.each(cases)(
    "レベル %s の問題 ID %s を選べるかを返すこと",
    (difficulty, id, expected) => {
      const selectable = canSelectMagicSquareProblemById(difficulty, id);

      expect(selectable).toBe(expected);
    },
  );
});
