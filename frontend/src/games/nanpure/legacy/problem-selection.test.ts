import { assessNanpureLegacyDifficulty } from "@/games/nanpure/legacy/difficulty";
import { generateNanpureLegacyProblemForDifficulty } from "@/games/nanpure/legacy/problem-selection";
import { classifyNanpureSolutions } from "@/games/nanpure/problem/generation/solver";

describe("generateNanpureLegacyProblemForDifficulty", () => {
  const cases = [
    ["easy", "nanpure-selection-easy"],
    ["normal", "nanpure-selection-normal"],
    ["hard", "nanpure-selection-hard"],
  ] as const;

  test.each(cases)(
    "%s と判定できる一意解問題を生成すること",
    (difficulty, seed) => {
      const problem = generateNanpureLegacyProblemForDifficulty(
        difficulty,
        seed,
      );
      const solution = classifyNanpureSolutions(problem.clues);
      const assessment = assessNanpureLegacyDifficulty(
        problem.difficultyAnalysis,
      );

      expect(solution.status).toBe("unique");
      expect(assessment).toMatchObject({ status: "rated", difficulty });
    },
  );
});
