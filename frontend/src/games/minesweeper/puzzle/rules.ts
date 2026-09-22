import {
  assertMinesweeperBoard,
  assertMinesweeperCellIndex,
  getMinesweeperCellCount,
  getMinesweeperNeighborCellIndices,
  type MinesweeperBoard,
} from "./board";
import type { MinesweeperPuzzleState } from "./state";

export function isMinesweeperMine(
  board: MinesweeperBoard,
  cellIndex: number,
): boolean {
  assertMinesweeperCellIndex(board, cellIndex);
  return board.mineCellIndices.includes(cellIndex);
}

export function getAdjacentMinesweeperMineCount(
  board: MinesweeperBoard,
  cellIndex: number,
): number {
  return getMinesweeperNeighborCellIndices(board, cellIndex).filter(
    (neighborCellIndex) => isMinesweeperMine(board, neighborCellIndex),
  ).length;
}

export function collectMinesweeperRevealCellIndices(
  board: MinesweeperBoard,
  startingCellIndices: readonly number[],
  blockedCellIndices: readonly number[] = [],
): number[] {
  assertMinesweeperBoard(board);

  const blocked = new Set(blockedCellIndices);
  const revealed = new Set<number>();
  const pending = [...startingCellIndices];

  while (pending.length > 0) {
    const cellIndex = pending.shift();
    if (
      cellIndex === undefined ||
      blocked.has(cellIndex) ||
      revealed.has(cellIndex)
    ) {
      continue;
    }

    assertMinesweeperCellIndex(board, cellIndex);
    if (isMinesweeperMine(board, cellIndex)) {
      continue;
    }

    revealed.add(cellIndex);
    if (getAdjacentMinesweeperMineCount(board, cellIndex) !== 0) {
      continue;
    }

    for (const neighborCellIndex of getMinesweeperNeighborCellIndices(
      board,
      cellIndex,
    )) {
      if (!revealed.has(neighborCellIndex)) {
        pending.push(neighborCellIndex);
      }
    }
  }

  return [...revealed].sort((left, right) => left - right);
}

export function isMinesweeperCleared(
  board: MinesweeperBoard,
  state: MinesweeperPuzzleState,
): boolean {
  const safeCellCount =
    getMinesweeperCellCount(board) - board.mineCellIndices.length;
  return state.revealedCellIndices.length === safeCellCount;
}
