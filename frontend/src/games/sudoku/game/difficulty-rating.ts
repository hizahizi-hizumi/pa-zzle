import type { SudokuDifficulty } from "./difficulty";
import {
  type SudokuDependencyFeatures,
  type SudokuHumanSolveFeatures,
  traceSudokuHumanSolve,
} from "./human-solver";
import type { SudokuBoard } from "./state";

export const SUDOKU_DIFFICULTY_MODEL_VERSION = "dependency-v1";

export const SUDOKU_DIFFICULTY_DEPENDENCY_THRESHOLDS = {
  hardMaximumMeanAvailablePlacementCount: 9.36,
  easyMinimumMeanAvailablePlacementCount: 14.6,
} as const;

export type RatedSudokuDifficulty = {
  status: "rated";
  modelVersion: typeof SUDOKU_DIFFICULTY_MODEL_VERSION;
  difficulty: SudokuDifficulty;
  features: SudokuHumanSolveFeatures;
};

export type UnsupportedSudokuDifficulty = {
  status: "unsupported";
  modelVersion: typeof SUDOKU_DIFFICULTY_MODEL_VERSION;
  features: SudokuHumanSolveFeatures;
};

export type SudokuDifficultyRating =
  | RatedSudokuDifficulty
  | UnsupportedSudokuDifficulty;

export function classifySudokuDependency(
  dependency: SudokuDependencyFeatures,
): SudokuDifficulty {
  const { meanAvailablePlacementCount } = dependency;

  if (
    meanAvailablePlacementCount <=
    SUDOKU_DIFFICULTY_DEPENDENCY_THRESHOLDS.hardMaximumMeanAvailablePlacementCount
  ) {
    return "hard";
  }

  if (
    meanAvailablePlacementCount >=
    SUDOKU_DIFFICULTY_DEPENDENCY_THRESHOLDS.easyMinimumMeanAvailablePlacementCount
  ) {
    return "easy";
  }

  return "normal";
}

export function rateUniqueSudokuDifficulty(
  board: SudokuBoard,
): SudokuDifficultyRating {
  const solve = traceSudokuHumanSolve(board);

  if (solve.status === "stalled") {
    return {
      status: "unsupported",
      modelVersion: SUDOKU_DIFFICULTY_MODEL_VERSION,
      features: solve.features,
    };
  }

  return {
    status: "rated",
    modelVersion: SUDOKU_DIFFICULTY_MODEL_VERSION,
    difficulty: classifySudokuDependency(solve.features.dependency),
    features: solve.features,
  };
}
