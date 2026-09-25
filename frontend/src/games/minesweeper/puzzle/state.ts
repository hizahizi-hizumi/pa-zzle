export type MinesweeperPuzzleState = {
  revealedCellIndices: readonly number[];
  flaggedCellIndices: readonly number[];
  // 開いてしまった地雷のマス。地雷と確定した既知のマスとして盤面に残り、以後は操作できない。
  steppedMineCellIndices: readonly number[];
};
