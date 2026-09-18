import { describe, expect, test } from "vitest";

import { generateSudokuProblemForDifficulty } from "./problem-selection";
import { classifySudokuSolutions } from "./solver";

describe("generateSudokuProblemForDifficulty", () => {
  test.each([
    ["easy", "sudoku-selection-easy"],
    ["normal", "sudoku-selection-normal"],
    ["hard", "sudoku-selection-hard"],
  ] as const)("%s と判定できる一意解問題を生成すること", (difficulty, seed) => {
    const problem = generateSudokuProblemForDifficulty(difficulty, seed);
    const solution = classifySudokuSolutions(problem.clues);

    expect(solution.status).toBe("unique");
    expect(problem.difficultyRating).toMatchObject({
      status: "rated",
      difficulty,
    });
  });
});
