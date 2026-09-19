import { classifyNanpureSolutions } from "./problem/generation/solver";
import { generateNanpureProblemForDifficulty } from "./problem-selection";

describe("generateNanpureProblemForDifficulty", () => {
  const cases = [
    ["easy", "nanpure-selection-easy"],
    ["normal", "nanpure-selection-normal"],
    ["hard", "nanpure-selection-hard"],
  ] as const;

  test.each(cases)(
    "%s と判定できる一意解問題を生成すること",
    (difficulty, seed) => {
      const problem = generateNanpureProblemForDifficulty(difficulty, seed);
      const solution = classifyNanpureSolutions(problem.clues);

      expect(solution.status).toBe("unique");
      expect(problem.difficultyRating).toMatchObject({
        status: "rated",
        difficulty,
      });
    },
  );
});
