import { difficultyLevels } from "@/games/difficulty";
import {
  _private,
  selectNonogramProblemById,
  selectNonogramProblemForDifficulty,
} from "@/games/nonogram/problem-selection";
import { createProblemId } from "@/games/problem-id";

const { provisionalBoardSizesByDifficulty, listProvisionalProblems } = _private;

describe("listProvisionalProblems", () => {
  const cases = difficultyLevels.map(({ id }) => [id] as const);

  test.each(cases)(
    "レベル %s の一覧が、そのレベルの盤面の大きさの問題だけを重複なく持つこと",
    (difficulty) => {
      const problems = listProvisionalProblems(difficulty);

      const sizes = new Set(
        provisionalBoardSizesByDifficulty[difficulty].map(
          ({ width, height }) => `${width}x${height}`,
        ),
      );
      const problemIds = problems.map(({ identity }) =>
        createProblemId(identity),
      );
      expect(problems.length).toBeGreaterThan(0);
      expect(
        problems.every(({ problem }) =>
          sizes.has(`${problem.width}x${problem.height}`),
        ),
      ).toBe(true);
      expect(new Set(problemIds).size).toBe(problemIds.length);
    },
  );
});

describe("selectNonogramProblemForDifficulty", () => {
  const seed = "nonogram-problem-selection";

  test("同じ seed からは同じ問題を選ぶこと", () => {
    const first = selectNonogramProblemForDifficulty("5", seed);
    const second = selectNonogramProblemForDifficulty("5", seed);

    expect(second.identity).toEqual(first.identity);
  });
});

describe("selectNonogramProblemById", () => {
  const selected = selectNonogramProblemForDifficulty("2", "nonogram-by-id");
  const problemId = createProblemId(selected.identity);

  test("選んだ問題を問題 ID で引けること", () => {
    const found = selectNonogramProblemById("2", problemId);

    expect(found).toEqual(selected);
  });

  test("一覧に無い問題 ID には null を返すこと", () => {
    const found = selectNonogramProblemById("2", "0000000000");

    expect(found).toBeNull();
  });

  test("別のレベルの一覧だけにある問題は引かないこと", () => {
    const found = selectNonogramProblemById(
      "5",
      createProblemId(listProvisionalProblems("1")[0]!.identity),
    );

    expect(found).toBeNull();
  });
});
