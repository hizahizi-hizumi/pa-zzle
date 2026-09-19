import type { ProblemSeed } from "@/games/problem-seed";
import {
  assertNanpureBoard,
  type NanpureBoard,
  type NanpureSolution,
} from "../puzzle/board";
import { isNanpureSolved } from "../puzzle/rules";
import type { NanpureDifficultyRating } from "./difficulty-rating";

export const NANPURE_GENERATOR_VERSION = "1";

export type NanpureGenerationConditions = {
  clueCount: number;
};

export type NanpureProblem = {
  clues: NanpureBoard;
  solution: NanpureSolution;
};

export type NanpureProblemIdentity = {
  generatorVersion: typeof NANPURE_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: NanpureGenerationConditions;
  generationAttempt: number;
};

export type NanpureGeneratedProblem = NanpureProblem & {
  identity: NanpureProblemIdentity;
  difficultyRating: NanpureDifficultyRating;
};

export function assertNanpureProblem(problem: NanpureProblem): void {
  assertNanpureBoard(problem.clues);
  assertNanpureBoard(problem.solution);

  if (!isNanpureSolved(problem.solution)) {
    throw new Error("Nanpure problem solution must be a solved board");
  }

  const cluesMatchSolution = problem.clues.every(
    (cell, cellIndex) => cell === null || cell === problem.solution[cellIndex],
  );
  if (!cluesMatchSolution) {
    throw new Error("Nanpure problem clues must match its solution");
  }
}
