import type { ProblemSeed } from "@/games/problem-seed";
import {
  assertTakuzuBoard,
  type TakuzuBoard,
} from "@/games/takuzu/puzzle/board";
import { isTakuzuSolved } from "@/games/takuzu/puzzle/rules";

/**
 * 1問を遊ぶためのデータ。
 * - `givens`: 初期配置。タイルがあるマスは固定マスになる。
 * - `solution`: ただ1つの解。
 */
export type TakuzuProblem = {
  givens: TakuzuBoard;
  solution: TakuzuBoard;
};

/** 同じ問題を再現するための情報。問題集から同じ問題を引き直すときに使う。 */
export type TakuzuProblemIdentity = {
  generatorVersion: "1";
  seed: ProblemSeed;
  conditions: { size: 8 };
};

export function assertTakuzuProblem(problem: TakuzuProblem): void {
  assertTakuzuBoard(problem.givens);
  assertTakuzuBoard(problem.solution);

  if (problem.givens.size !== problem.solution.size) {
    throw new RangeError("Takuzu givens and solution must share a board size");
  }

  if (!isTakuzuSolved(problem.solution)) {
    throw new Error("Takuzu solution must satisfy every rule");
  }

  const contradictsSolution = problem.givens.cells.some(
    function contradicts(cell, cellIndex) {
      return cell !== null && cell !== problem.solution.cells[cellIndex];
    },
  );
  if (contradictsSolution) {
    throw new Error("Takuzu givens must agree with the solution");
  }
}
