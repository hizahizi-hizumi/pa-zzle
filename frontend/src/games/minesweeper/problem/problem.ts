import {
  assertMinesweeperBoard,
  assertMinesweeperCellIndex,
  type MinesweeperBoard,
} from "@/games/minesweeper/puzzle/board";
import { isMinesweeperMine } from "@/games/minesweeper/puzzle/rules";
import type { ProblemSeed } from "@/games/problem-seed";

export const MINESWEEPER_GENERATOR_VERSION = "1";

export type MinesweeperProblem = {
  board: MinesweeperBoard;
  initialRevealedCellIndices: readonly number[];
};

/**
 * 開始マスの決め方。
 * `random` は seed から盤面の全マスを一様に、`center` は盤面中央（偶数辺では中央寄りの左上）を選ぶ。
 */
export type MinesweeperStartCellPlacement = "random" | "center";

export type MinesweeperGenerationConditions = {
  rows: number;
  columns: number;
  mineCount: number;
  startCellPlacement: MinesweeperStartCellPlacement;
};

export type MinesweeperProblemIdentity = {
  generatorVersion: typeof MINESWEEPER_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: MinesweeperGenerationConditions;
  generationAttempt: number;
};

export function assertMinesweeperProblem(problem: MinesweeperProblem): void {
  assertMinesweeperBoard(problem.board);

  const initialRevealedCells = new Set<number>();
  for (const cellIndex of problem.initialRevealedCellIndices) {
    assertMinesweeperCellIndex(problem.board, cellIndex);
    if (initialRevealedCells.has(cellIndex)) {
      throw new Error("Minesweeper initial revealed cells must be unique");
    }
    if (isMinesweeperMine(problem.board, cellIndex)) {
      throw new Error("Minesweeper initial revealed cells must be safe");
    }
    initialRevealedCells.add(cellIndex);
  }
}
