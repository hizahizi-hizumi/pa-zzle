import type { MinesweeperProblem } from "./problem";

export const minesweeperReviewProblem: MinesweeperProblem = {
  board: {
    rows: 9,
    columns: 9,
    mineCellIndices: [22, 23, 29, 34, 36, 45, 46, 55, 64, 76],
  },
  initialRevealedCellIndices: [
    30, 31, 32, 33, 38, 39, 40, 41, 42, 43, 44, 47, 48, 49, 50, 51, 52, 53, 56,
    57, 58, 59, 60, 61, 62, 65, 66, 67, 68, 69, 70, 71, 77, 78, 79, 80,
  ],
};
