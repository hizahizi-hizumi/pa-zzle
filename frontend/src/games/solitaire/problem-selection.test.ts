import { difficultyLevels } from "@/games/difficulty";
import { createProblemId } from "@/games/problem-id";
import { listSolitairePoolEntries } from "@/games/solitaire/problem/problem-pool";
import {
  canSelectSolitaireProblemById,
  selectSolitaireProblemById,
  selectSolitaireProblemForDifficulty,
} from "@/games/solitaire/problem-selection";

const difficulties = difficultyLevels.map(({ id }) => id);

describe("selectSolitaireProblemForDifficulty", () => {
  test.each(difficulties)(
    "レベル %s の問題集から同じ seed で同じ問題を選ぶこと",
    (difficulty) => {
      const first = selectSolitaireProblemForDifficulty(difficulty, "seed-a");
      const second = selectSolitaireProblemForDifficulty(difficulty, "seed-a");

      expect(second).toEqual(first);
      expect(listSolitairePoolEntries(difficulty)).toContain(
        first.identity.seed,
      );
    },
  );
});

describe("selectSolitaireProblemById", () => {
  const selected = selectSolitaireProblemForDifficulty("4", "seed-b");
  const problemId = createProblemId(selected.identity);

  test("選んだ問題の問題 ID で同じ問題を引くこと", () => {
    const found = selectSolitaireProblemById("4", problemId);

    expect(found).toEqual(selected);
  });

  test("別の難易度では同じ問題 ID の問題を引かないこと", () => {
    const found = selectSolitaireProblemById("5", problemId);

    expect(found).toBeNull();
  });
});

describe("canSelectSolitaireProblemById", () => {
  const selected = selectSolitaireProblemForDifficulty("2", "seed-c");
  const cases = [
    ["問題集の問題 ID", createProblemId(selected.identity), true],
    ["問題集に無い問題 ID", "0000000000", false],
  ] as const;

  test.each(cases)("%s を引けるかを返すこと", (_, problemId, expected) => {
    const selectable = canSelectSolitaireProblemById("2", problemId);

    expect(selectable).toBe(expected);
  });
});
