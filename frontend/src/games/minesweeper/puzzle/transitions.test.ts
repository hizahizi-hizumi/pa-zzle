import type { MinesweeperBoard } from "@/games/minesweeper/puzzle/board";
import type { MinesweeperPuzzleState } from "@/games/minesweeper/puzzle/state";
import {
  chordMinesweeperCell,
  revealMinesweeperCell,
  toggleMinesweeperFlag,
} from "@/games/minesweeper/puzzle/transitions";

describe("revealMinesweeperCell", () => {
  const board: MinesweeperBoard = {
    rows: 2,
    columns: 2,
    mineCellIndices: [0],
  };
  const state: MinesweeperPuzzleState = {
    revealedCellIndices: [],
    flaggedCellIndices: [],
    explodedCellIndex: null,
  };

  test("地雷を開示すると爆発したマスを記録すること", () => {
    const result = revealMinesweeperCell(board, state, 0);

    expect(result.explodedCellIndex).toBe(0);
    expect(result.revealedCellIndices).toEqual([]);
  });
});

describe("toggleMinesweeperFlag", () => {
  const board: MinesweeperBoard = {
    rows: 2,
    columns: 2,
    mineCellIndices: [0],
  };
  const state: MinesweeperPuzzleState = {
    revealedCellIndices: [],
    flaggedCellIndices: [],
    explodedCellIndex: null,
  };

  test("未開示マスの旗を付け外しできること", () => {
    const flagged = toggleMinesweeperFlag(board, state, 0);
    const unflagged = toggleMinesweeperFlag(board, flagged, 0);

    expect(flagged.flaggedCellIndices).toEqual([0]);
    expect(unflagged.flaggedCellIndices).toEqual([]);
  });
});

describe("chordMinesweeperCell", () => {
  const board: MinesweeperBoard = {
    rows: 2,
    columns: 3,
    mineCellIndices: [0],
  };

  test("周囲の旗数が数字と一致すると未旗の安全マスを開示すること", () => {
    const state: MinesweeperPuzzleState = {
      revealedCellIndices: [1],
      flaggedCellIndices: [0],
      explodedCellIndex: null,
    };

    const result = chordMinesweeperCell(board, state, 1);

    expect(result.revealedCellIndices).toEqual([1, 2, 3, 4, 5]);
    expect(result.explodedCellIndex).toBeNull();
  });

  test("誤った旗で数字だけ一致すると地雷を開いて失敗させること", () => {
    const state: MinesweeperPuzzleState = {
      revealedCellIndices: [1],
      flaggedCellIndices: [2],
      explodedCellIndex: null,
    };

    const result = chordMinesweeperCell(board, state, 1);

    expect(result.explodedCellIndex).toBe(0);
    expect(result.revealedCellIndices).toEqual([1]);
  });
});
