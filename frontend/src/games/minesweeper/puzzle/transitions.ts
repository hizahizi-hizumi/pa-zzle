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

export function revealMinesweeperCell(
  board: MinesweeperBoard,
  state: MinesweeperPuzzleState,
  cellIndex: number,
): MinesweeperPuzzleState {
  assertMinesweeperCellIndex(board, cellIndex);

  if (
    state.explodedCellIndex !== null ||
    state.revealedCellIndices.includes(cellIndex) ||
    state.flaggedCellIndices.includes(cellIndex)
  ) {
    return state;
  }

  if (isMinesweeperMine(board, cellIndex)) {
    return { ...state, explodedCellIndex: cellIndex };
  }

  const revealedCellIndices = collectMinesweeperRevealCellIndices(
    board,
    [cellIndex],
    state.flaggedCellIndices,
  );

  return {
    ...state,
    revealedCellIndices: mergeCellIndices(
      state.revealedCellIndices,
      revealedCellIndices,
    ),
  };
}

export function toggleMinesweeperFlag(
  board: MinesweeperBoard,
  state: MinesweeperPuzzleState,
  cellIndex: number,
): MinesweeperPuzzleState {
  assertMinesweeperCellIndex(board, cellIndex);

  if (
    state.explodedCellIndex !== null ||
    state.revealedCellIndices.includes(cellIndex)
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

export function chordMinesweeperCell(
  board: MinesweeperBoard,
  state: MinesweeperPuzzleState,
  cellIndex: number,
): MinesweeperPuzzleState {
  assertMinesweeperCellIndex(board, cellIndex);

  if (
    state.explodedCellIndex !== null ||
    !state.revealedCellIndices.includes(cellIndex)
  ) {
    return state;
  }

  const mineCount = getAdjacentMinesweeperMineCount(board, cellIndex);
  if (mineCount === 0) {
    return state;
  }

  const neighbors = getMinesweeperNeighborCellIndices(board, cellIndex);
  const flaggedCount = neighbors.filter((neighborCellIndex) =>
    state.flaggedCellIndices.includes(neighborCellIndex),
  ).length;
  if (flaggedCount !== mineCount) {
    return state;
  }

  const hiddenUnflaggedNeighbors = neighbors.filter(
    (neighborCellIndex) =>
      !state.revealedCellIndices.includes(neighborCellIndex) &&
      !state.flaggedCellIndices.includes(neighborCellIndex),
  );
  const explodedCellIndex = hiddenUnflaggedNeighbors.find((neighborCellIndex) =>
    isMinesweeperMine(board, neighborCellIndex),
  );
  if (explodedCellIndex !== undefined) {
    return { ...state, explodedCellIndex };
  }

  const revealedCellIndices = collectMinesweeperRevealCellIndices(
    board,
    hiddenUnflaggedNeighbors,
    state.flaggedCellIndices,
  );

  return {
    ...state,
    revealedCellIndices: mergeCellIndices(
      state.revealedCellIndices,
      revealedCellIndices,
    ),
  };
}
