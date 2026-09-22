import { assessWaterSortDifficulty } from "@/games/water-sort/difficulty";
import { generateWaterSortProblemForDifficulty } from "@/games/water-sort/problem-selection";

describe("generateWaterSortProblemForDifficulty", () => {
  const cases = [
    ["1", "issue296-selection-level-1-000"],
    ["2", "issue296-selection-level-2-000"],
    ["3", "issue296-selection-level-3-000"],
    ["4", "issue296-selection-level-4-000"],
    ["5", "issue296-selection-level-5-000"],
  ] as const;

  test.each(cases)(
    "難易度 %s の特徴量条件を満たす問題を生成すること",
    (difficulty, seed) => {
      const problem = generateWaterSortProblemForDifficulty(difficulty, seed);
      const assessment = assessWaterSortDifficulty(problem.difficultyAnalysis);

      expect(assessment.difficulty).toBe(difficulty);
    },
  );
});
