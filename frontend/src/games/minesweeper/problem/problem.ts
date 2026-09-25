import type { ProblemSeed } from "@/games/problem-seed";
import {
  assertMinesweeperBoard,
  assertMinesweeperCellIndex,
  getMinesweeperCellCount,
  type MinesweeperBoard,
} from "@/games/minesweeper/puzzle/board";
import {
  collectMinesweeperRevealCellIndices,
  getAdjacentMinesweeperMineCount,
  isMinesweeperMine,
} from "@/games/minesweeper/puzzle/rules";

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

/**
 * 初期開示状態から、旗もまとめて開く操作も使わずに安全なマスをすべて開くのに要る、開く操作の最小回数。
 * 未開示の0のマスは連鎖で開く範囲ごとに1回、どの連鎖にも含まれない数字のマスは1マスごとに1回と数える（いわゆる 3BV）。
 */
export function countMinesweeperMinimumOpenCount(
  problem: MinesweeperProblem,
): number {
  const { board } = problem;
  const revealed = new Set(problem.initialRevealedCellIndices);
  const safeCellIndices = Array.from(
    { length: getMinesweeperCellCount(board) },
    (_, cellIndex) => cellIndex,
  ).filter((cellIndex) => !isMinesweeperMine(board, cellIndex));
  let openCount = 0;

  for (const cellIndex of safeCellIndices) {
    if (
      revealed.has(cellIndex) ||
      getAdjacentMinesweeperMineCount(board, cellIndex) !== 0
    ) {
      continue;
    }
    openCount += 1;
    for (const openedCellIndex of collectMinesweeperRevealCellIndices(board, [
      cellIndex,
    ])) {
      revealed.add(openedCellIndex);
    }
  }

  for (const cellIndex of safeCellIndices) {
    if (!revealed.has(cellIndex)) {
      openCount += 1;
    }
  }

  return openCount;
}
