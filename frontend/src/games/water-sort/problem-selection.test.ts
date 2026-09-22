import { assessWaterSortDifficulty } from "@/games/water-sort/difficulty";
import { generateWaterSortProblemForDifficulty } from "@/games/water-sort/problem-selection";

describe("generateWaterSortProblemForDifficulty", () => {
  const cases = [
    ["easy", "issue69-selection-easy-000"],
    ["normal", "issue69-selection-normal-000"],
    ["hard", "issue69-selection-hard-001"],
  ] as const;

  test.each(cases)(
    "%s の特徴量条件を満たす問題を生成すること",
    (difficulty, seed) => {
      const problem = generateWaterSortProblemForDifficulty(difficulty, seed);
      const assessment = assessWaterSortDifficulty(problem.difficultyAnalysis);

      expect(assessment.difficulty).toBe(difficulty);
    },
  );
});
