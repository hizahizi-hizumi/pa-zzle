import {
  assertNanpureBoard,
  type NanpureBoard,
  type NanpureSolution,
} from "@/games/nanpure/puzzle/board";
import { isNanpureSolved } from "@/games/nanpure/puzzle/rules";

export type NanpureProblem = {
  clues: NanpureBoard;
  solution: NanpureSolution;
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
