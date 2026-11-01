import { difficultyLevels } from "@/games/difficulty";
import {
  decodeNonogramPoolEntry,
  listNonogramPoolEntries,
  toNonogramPooledProblem,
} from "@/games/nonogram/problem/problem-pool";
import {
  selectNonogramProblemById,
  selectNonogramProblemForDifficulty,
} from "@/games/nonogram/problem-selection";
import { createProblemId } from "@/games/problem-id";

const difficulties = difficultyLevels.map(({ id }) => id);

describe("selectNonogramProblemForDifficulty", () => {
  const seed = "nonogram-problem-selection";

  test("同じ seed からは同じ問題を選ぶこと", () => {
    const first = selectNonogramProblemForDifficulty("5", seed);
    const second = selectNonogramProblemForDifficulty("5", seed);

    expect(second).toEqual(first);
  });

  test.each(difficulties)(
    "レベル %s で異なる seed からそのレベルの問題集の複数の問題を選ぶこと",
    (difficulty) => {
      const poolProblemIds = new Set(
        listNonogramPoolEntries(difficulty).map((entry) =>
          createProblemId(decodeNonogramPoolEntry(entry).identity),
        ),
      );
      const selectedProblemIds = Array.from({ length: 20 }, (_, index) =>
        createProblemId(
          selectNonogramProblemForDifficulty(difficulty, `${seed}-${index}`)
            .identity,
        ),
      );

      expect(
        selectedProblemIds.every((problemId) => poolProblemIds.has(problemId)),
      ).toBe(true);
      expect(new Set(selectedProblemIds).size).toBeGreaterThan(1);
    },
  );

  test("選んだ問題に問題集の中の位置を添えること", () => {
    const selected = selectNonogramProblemForDifficulty("3", seed);

    expect(selected.poolReference.problemId).toMatch(/^3-\d+$/);
  });

  test("選んだ結果に難易度分析を含めず、問題と identity と問題集の中の位置と作業の量だけを伴うこと", () => {
    const selected = selectNonogramProblemForDifficulty("1", seed);

    expect(Object.keys(selected).sort()).toEqual([
      "identity",
      "poolReference",
      "problem",
      "workload",
    ]);
  });
});

describe("selectNonogramProblemById", () => {
  const selected = selectNonogramProblemForDifficulty("2", "nonogram-by-id");
  const problemId = createProblemId(selected.identity);
  const levelOneProblemId = createProblemId(
    toNonogramPooledProblem("1", 0).identity,
  );

  test("選んだ問題を問題 ID で引けること", () => {
    const found = selectNonogramProblemById("2", problemId);

    expect(found).toEqual(selected);
  });

  test("問題集に無い問題 ID には null を返すこと", () => {
    const found = selectNonogramProblemById("2", "0000000000");

    expect(found).toBeNull();
  });

  test("別のレベルの問題集だけにある問題は引かないこと", () => {
    const found = selectNonogramProblemById("5", levelOneProblemId);

    expect(found).toBeNull();
  });
});
