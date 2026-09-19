import { describe, expect, test } from "vitest";

import { assessNanpureDifficulty } from "./difficulty";
import { generateNanpureProblemForDifficulty } from "./problem-selection";
import { classifyNanpureSolutions } from "./puzzle/solver";

describe("generateNanpureProblemForDifficulty", () => {
  test.each([
    ["easy", "nanpure-selection-easy"],
    ["normal", "nanpure-selection-normal"],
    ["hard", "nanpure-selection-hard"],
  ] as const)("%s と判定できる一意解問題を生成すること", (difficulty, seed) => {
    const problem = generateNanpureProblemForDifficulty(difficulty, seed);
    const solution = classifyNanpureSolutions(problem.clues);

    expect(solution.status).toBe("unique");
    const assessment = assessNanpureDifficulty(problem.difficultyAnalysis);

    expect(assessment).toMatchObject({ status: "rated", difficulty });
  });
});
