import {
  assertMinesweeperCellIndex,
  getMinesweeperNeighborCellIndices,
  type MinesweeperBoard,
} from "./board";
import {
  collectMinesweeperRevealCellIndices,
  getAdjacentMinesweeperMineCount,
  isMinesweeperMine,
} from "./rules";
import type { MinesweeperPuzzleState } from "./state";

function mergeCellIndices(
  currentCellIndices: readonly number[],
  addedCellIndices: readonly number[],
): number[] {
  return [...new Set([...currentCellIndices, ...addedCellIndices])].sort(
    (left, right) => left - right,
  );
}

function isOpenableCell(
  state: MinesweeperPuzzleState,
  cellIndex: number,
): boolean {
  return (
    !state.revealedCellIndices.includes(cellIndex) &&
    !state.flaggedCellIndices.includes(cellIndex) &&
    !state.steppedMineCellIndices.includes(cellIndex)
  );
}

// 指定したマスをまとめて開く。地雷のマスは踏んだ地雷として残し、安全なマスは連鎖開示する。
function openMinesweeperCells(
  board: MinesweeperBoard,
  state: MinesweeperPuzzleState,
  cellIndices: readonly number[],
): MinesweeperPuzzleState {
  const steppedMineCellIndices = cellIndices.filter((cellIndex) =>
    isMinesweeperMine(board, cellIndex),
  );
  const revealedCellIndices = collectMinesweeperRevealCellIndices(
    board,
    cellIndices.filter((cellIndex) => !isMinesweeperMine(board, cellIndex)),
    state.flaggedCellIndices,
  );

  return {
    ...state,
    revealedCellIndices: mergeCellIndices(
      state.revealedCellIndices,
      revealedCellIndices,
    ),
    steppedMineCellIndices: mergeCellIndices(
      state.steppedMineCellIndices,
      steppedMineCellIndices,
    ),
  };
}

export function revealMinesweeperCell(
  board: MinesweeperBoard,
  state: MinesweeperPuzzleState,
  cellIndex: number,
): MinesweeperPuzzleState {
  assertMinesweeperCellIndex(board, cellIndex);

  if (!isOpenableCell(state, cellIndex)) {
    return state;
  }

  return openMinesweeperCells(board, state, [cellIndex]);
}

export function toggleMinesweeperFlag(
  board: MinesweeperBoard,
  state: MinesweeperPuzzleState,
  cellIndex: number,
): MinesweeperPuzzleState {
  assertMinesweeperCellIndex(board, cellIndex);

  if (
    state.revealedCellIndices.includes(cellIndex) ||
    state.steppedMineCellIndices.includes(cellIndex)
  ) {
    return state;
  }

  if (state.flaggedCellIndices.includes(cellIndex)) {
    return {
      ...state,
      flaggedCellIndices: state.flaggedCellIndices.filter(
        (flaggedCellIndex) => flaggedCellIndex !== cellIndex,
      ),
    };
  }

  return {
    ...state,
    flaggedCellIndices: [...state.flaggedCellIndices, cellIndex].sort(
      (left, right) => left - right,
    ),
  };
}

/**
 * 開いた数字のマスの周囲で、旗と踏んだ地雷の合計が数字と一致していれば、
 * 残りの未開示マスをまとめて開く。旗が誤っていれば、周囲の地雷をすべて踏む。
 */
export function chordMinesweeperCell(
  board: MinesweeperBoard,
  state: MinesweeperPuzzleState,
  cellIndex: number,
): MinesweeperPuzzleState {
  assertMinesweeperCellIndex(board, cellIndex);

  if (!state.revealedCellIndices.includes(cellIndex)) {
    return state;
  }

  const mineCount = getAdjacentMinesweeperMineCount(board, cellIndex);
  if (mineCount === 0) {
    return state;
  }

  const neighbors = getMinesweeperNeighborCellIndices(board, cellIndex);
  const markedMineCount = neighbors.filter(
    (neighborCellIndex) =>
      state.flaggedCellIndices.includes(neighborCellIndex) ||
      state.steppedMineCellIndices.includes(neighborCellIndex),
  ).length;
  if (markedMineCount !== mineCount) {
    return state;
  }

  const openableNeighbors = neighbors.filter((neighborCellIndex) =>
    isOpenableCell(state, neighborCellIndex),
  );
  if (openableNeighbors.length === 0) {
    return state;
  }

  return openMinesweeperCells(board, state, openableNeighbors);
}
