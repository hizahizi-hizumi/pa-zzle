export type MinesweeperPuzzleState = {
  revealedCellIndices: readonly number[];
  flaggedCellIndices: readonly number[];
  explodedCellIndex: number | null;
};
