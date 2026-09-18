import type { Seed } from "@/games/core/seed";

import type { SudokuDifficulty } from "./difficulty";
import {
  type GeneratedSudokuProblem,
  generateSudokuProblem,
  SudokuGenerationExhaustedError,
} from "./generator";

const MAXIMUM_ATTEMPTS_PER_CLUE_COUNT = 12;

const PREFERRED_CLUE_COUNTS_BY_DIFFICULTY: Record<
  SudokuDifficulty,
  readonly number[]
> = {
  easy: [40, 36, 32],
  normal: [32, 36, 28, 40],
  hard: [28, 24, 32],
};

export function generateSudokuProblemForDifficulty(
  difficulty: SudokuDifficulty,
  seed: Seed,
): GeneratedSudokuProblem {
  for (const clueCount of PREFERRED_CLUE_COUNTS_BY_DIFFICULTY[difficulty]) {
    try {
      return generateSudokuProblem({
        seed,
        clueCount,
        maximumAttempts: MAXIMUM_ATTEMPTS_PER_CLUE_COUNT,
        acceptCandidate: ({ difficultyRating }) =>
          difficultyRating.status === "rated" &&
          difficultyRating.difficulty === difficulty,
      });
    } catch (error) {
      if (!(error instanceof SudokuGenerationExhaustedError)) {
        throw error;
      }
    }
  }

  throw new Error(`Failed to generate a ${difficulty} Sudoku problem`);
}
