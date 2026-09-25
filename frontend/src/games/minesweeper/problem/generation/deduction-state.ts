import {
  getMinesweeperCellCount,
  getMinesweeperNeighborCellIndices,
  type MinesweeperBoard,
} from "@/games/minesweeper/puzzle/board";
import { collectMinesweeperRevealCellIndices } from "@/games/minesweeper/puzzle/rules";
import type { MinesweeperProblem } from "@/games/minesweeper/problem/problem";

/**
 * 推論に使える可視情報で表した局面。
 * 盤面の地雷配置は開示済みマスの数字と0連鎖の開示にだけ使い、未確定マスの中身は推論に使わない。
 */
export type MinesweeperDeductionState = {
  board: MinesweeperBoard;
  neighborCellIndices: readonly (readonly number[])[];
  adjacentMineCounts: readonly number[];
  revealedCellIndices: ReadonlySet<number>;
  knownMineCellIndices: ReadonlySet<number>;
};

/** 開示済みの数字1つが未確定マスへ課す「この集合にちょうど mineCount 個の地雷がある」という制約。 */
export type MinesweeperNumberConstraint = {
  cellIndices: readonly number[];
  mineCount: number;
};

export type MinesweeperDeduction = {
  safeCellIndices: readonly number[];
  mineCellIndices: readonly number[];
};

export function createMinesweeperDeductionState(
  problem: MinesweeperProblem,
): MinesweeperDeductionState {
  const { board } = problem;
  const cellCount = getMinesweeperCellCount(board);
  const mines = new Set(board.mineCellIndices);
  const neighborCellIndices = Array.from(
    { length: cellCount },
    (_, cellIndex) => getMinesweeperNeighborCellIndices(board, cellIndex),
  );
  const adjacentMineCounts = neighborCellIndices.map(
    (neighbors) => neighbors.filter((neighbor) => mines.has(neighbor)).length,
  );

  return {
    board,
    neighborCellIndices,
    adjacentMineCounts,
    revealedCellIndices: new Set(problem.initialRevealedCellIndices),
    knownMineCellIndices: new Set(),
  };
}

export function isMinesweeperCellUndetermined(
  state: MinesweeperDeductionState,
  cellIndex: number,
): boolean {
  return (
    !state.revealedCellIndices.has(cellIndex) &&
    !state.knownMineCellIndices.has(cellIndex)
  );
}

export function listUndeterminedMinesweeperCellIndices(
  state: MinesweeperDeductionState,
): number[] {
  const cellCount = getMinesweeperCellCount(state.board);
  const cellIndices: number[] = [];
  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    if (isMinesweeperCellUndetermined(state, cellIndex)) {
      cellIndices.push(cellIndex);
    }
  }
  return cellIndices;
}

export function countRemainingMinesweeperMines(
  state: MinesweeperDeductionState,
): number {
  return state.board.mineCellIndices.length - state.knownMineCellIndices.size;
}

export function isMinesweeperDeductionComplete(
  state: MinesweeperDeductionState,
): boolean {
  const safeCellCount =
    getMinesweeperCellCount(state.board) - state.board.mineCellIndices.length;
  return state.revealedCellIndices.size === safeCellCount;
}

/**
 * 未確定マスに隣接する開示済み数字ごとの制約を、未確定マス集合の昇順で返す。
 * 同じ未確定マス集合を持つ制約は同じ情報なので1つにまとめる。
 */
export function collectMinesweeperNumberConstraints(
  state: MinesweeperDeductionState,
): MinesweeperNumberConstraint[] {
  const constraintsByCellKey = new Map<string, MinesweeperNumberConstraint>();

  for (const revealedCellIndex of [...state.revealedCellIndices].sort(
    (left, right) => left - right,
  )) {
    const neighbors = state.neighborCellIndices[revealedCellIndex]!;
    const undeterminedNeighbors = neighbors.filter((neighbor) =>
      isMinesweeperCellUndetermined(state, neighbor),
    );
    if (undeterminedNeighbors.length === 0) {
      continue;
    }

    const knownMineNeighborCount = neighbors.filter((neighbor) =>
      state.knownMineCellIndices.has(neighbor),
    ).length;
    const cellIndices = undeterminedNeighbors.sort(
      (left, right) => left - right,
    );
    constraintsByCellKey.set(cellIndices.join(","), {
      cellIndices,
      mineCount:
        state.adjacentMineCounts[revealedCellIndex]! - knownMineNeighborCount,
    });
  }

  return [...constraintsByCellKey.values()].sort(compareConstraints);
}

function compareConstraints(
  left: MinesweeperNumberConstraint,
  right: MinesweeperNumberConstraint,
): number {
  const length = Math.min(left.cellIndices.length, right.cellIndices.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.cellIndices[index]! - right.cellIndices[index]!;
    if (difference !== 0) {
      return difference;
    }
  }
  return left.cellIndices.length - right.cellIndices.length;
}

/** 確定した安全マスを0連鎖込みで開示し、確定した地雷を既知地雷として記録した局面を返す。 */
export function applyMinesweeperDeduction(
  state: MinesweeperDeductionState,
  deduction: MinesweeperDeduction,
): MinesweeperDeductionState {
  const newlyRevealedCellIndices = collectMinesweeperRevealCellIndices(
    state.board,
    deduction.safeCellIndices,
    [...state.revealedCellIndices],
  );

  return {
    ...state,
    revealedCellIndices: new Set([
      ...state.revealedCellIndices,
      ...newlyRevealedCellIndices,
    ]),
    knownMineCellIndices: new Set([
      ...state.knownMineCellIndices,
      ...deduction.mineCellIndices,
    ]),
  };
}

export function isMinesweeperDeductionEmpty(
  deduction: MinesweeperDeduction,
): boolean {
  return (
    deduction.safeCellIndices.length === 0 &&
    deduction.mineCellIndices.length === 0
  );
}
