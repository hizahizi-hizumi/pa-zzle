import {
  assertMinesweeperBoard,
  assertMinesweeperCellIndex,
  type MinesweeperBoard,
} from "../puzzle/board";
import { isMinesweeperMine } from "../puzzle/rules";

export type MinesweeperProblem = {
  board: MinesweeperBoard;
  initialRevealedCellIndices: readonly number[];
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
