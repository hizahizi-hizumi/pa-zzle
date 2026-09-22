import type { MinesweeperBoard } from "./board";
import {
  collectMinesweeperRevealCellIndices,
  getAdjacentMinesweeperMineCount,
} from "./rules";

describe("getAdjacentMinesweeperMineCount", () => {
  const board: MinesweeperBoard = {
    rows: 3,
    columns: 3,
    mineCellIndices: [0, 2],
  };

  test("周囲8マスにある地雷数を返すこと", () => {
    const result = getAdjacentMinesweeperMineCount(board, 1);

    expect(result).toBe(2);
  });
});

describe("collectMinesweeperRevealCellIndices", () => {
  const board: MinesweeperBoard = {
    rows: 3,
    columns: 3,
    mineCellIndices: [0],
  };

  test("0のマスから連続する安全領域と境界数字を開示すること", () => {
    const result = collectMinesweeperRevealCellIndices(board, [8]);

    expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test("旗などで保護されたマスを連鎖開示しないこと", () => {
    const result = collectMinesweeperRevealCellIndices(board, [8], [7]);

    expect(result).not.toContain(7);
  });
});
