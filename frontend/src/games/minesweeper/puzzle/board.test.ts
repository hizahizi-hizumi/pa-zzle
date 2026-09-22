import {
  getMinesweeperCellCount,
  getMinesweeperNeighborCellIndices,
  type MinesweeperBoard,
} from "./board";

describe("getMinesweeperCellCount", () => {
  const board: MinesweeperBoard = {
    rows: 3,
    columns: 4,
    mineCellIndices: [1],
  };

  test("行数と列数からマス数を求めること", () => {
    const result = getMinesweeperCellCount(board);

    expect(result).toBe(12);
  });
});

describe("getMinesweeperNeighborCellIndices", () => {
  const board: MinesweeperBoard = {
    rows: 3,
    columns: 3,
    mineCellIndices: [8],
  };

  test("角のマスでは隣接する3マスを返すこと", () => {
    const result = getMinesweeperNeighborCellIndices(board, 0);

    expect(result).toEqual([1, 3, 4]);
  });

  test("中央のマスでは隣接する8マスを返すこと", () => {
    const result = getMinesweeperNeighborCellIndices(board, 4);

    expect(result).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
  });
});
