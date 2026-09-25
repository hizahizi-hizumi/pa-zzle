import type { MinesweeperBoard } from "./board";
import type { MinesweeperPuzzleState } from "./state";
import {
  chordMinesweeperCell,
  revealMinesweeperCell,
  toggleMinesweeperFlag,
} from "./transitions";

describe("revealMinesweeperCell", () => {
  const board: MinesweeperBoard = {
    rows: 2,
    columns: 2,
    mineCellIndices: [0],
  };
  const state: MinesweeperPuzzleState = {
    revealedCellIndices: [],
    flaggedCellIndices: [],
    steppedMineCellIndices: [],
  };

  test("地雷を開示すると踏んだ地雷として記録すること", () => {
    const result = revealMinesweeperCell(board, state, 0);

    expect(result.steppedMineCellIndices).toEqual([0]);
    expect(result.revealedCellIndices).toEqual([]);
  });

  test("地雷を踏んだ後も安全なマスを開示できること", () => {
    const stepped = revealMinesweeperCell(board, state, 0);
    const result = revealMinesweeperCell(board, stepped, 3);

    expect(result.revealedCellIndices).toEqual([3]);
    expect(result.steppedMineCellIndices).toEqual([0]);
  });

  test("踏んだ地雷をもう一度開示しないこと", () => {
    const stepped = revealMinesweeperCell(board, state, 0);
    const result = revealMinesweeperCell(board, stepped, 0);

    expect(result).toBe(stepped);
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
    steppedMineCellIndices: [],
  };

  test("未開示マスの旗を付け外しできること", () => {
    const flagged = toggleMinesweeperFlag(board, state, 0);
    const unflagged = toggleMinesweeperFlag(board, flagged, 0);

    expect(flagged.flaggedCellIndices).toEqual([0]);
    expect(unflagged.flaggedCellIndices).toEqual([]);
  });

  test("踏んだ地雷に旗を置かないこと", () => {
    const stepped = revealMinesweeperCell(board, state, 0);
    const result = toggleMinesweeperFlag(board, stepped, 0);

    expect(result).toBe(stepped);
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
      steppedMineCellIndices: [],
    };

    const result = chordMinesweeperCell(board, state, 1);

    expect(result.revealedCellIndices).toEqual([1, 2, 3, 4, 5]);
    expect(result.steppedMineCellIndices).toEqual([]);
  });

  test("誤った旗で数字だけ一致すると地雷を踏み、残りの安全マスも開示すること", () => {
    const state: MinesweeperPuzzleState = {
      revealedCellIndices: [1],
      flaggedCellIndices: [2],
      steppedMineCellIndices: [],
    };

    const result = chordMinesweeperCell(board, state, 1);

    expect(result.steppedMineCellIndices).toEqual([0]);
    expect(result.revealedCellIndices).toEqual([1, 3, 4, 5]);
  });

  test("踏んだ地雷を周囲の地雷として数えること", () => {
    const state: MinesweeperPuzzleState = {
      revealedCellIndices: [1],
      flaggedCellIndices: [],
      steppedMineCellIndices: [0],
    };

    const result = chordMinesweeperCell(board, state, 1);

    expect(result.revealedCellIndices).toEqual([1, 2, 3, 4, 5]);
    expect(result.steppedMineCellIndices).toEqual([0]);
  });

  test("誤った旗が複数あると周囲の地雷をすべて踏むこと", () => {
    const twoMineBoard: MinesweeperBoard = {
      rows: 2,
      columns: 3,
      mineCellIndices: [0, 2],
    };
    const state: MinesweeperPuzzleState = {
      revealedCellIndices: [1],
      flaggedCellIndices: [3, 5],
      steppedMineCellIndices: [],
    };

    const result = chordMinesweeperCell(twoMineBoard, state, 1);

    expect(result.steppedMineCellIndices).toEqual([0, 2]);
    expect(result.revealedCellIndices).toEqual([1, 4]);
  });

  test("開けるマスが残っていなければ状態を変えないこと", () => {
    const state: MinesweeperPuzzleState = {
      revealedCellIndices: [1, 2, 3, 4, 5],
      flaggedCellIndices: [],
      steppedMineCellIndices: [0],
    };

    const result = chordMinesweeperCell(board, state, 1);

    expect(result).toBe(state);
  });
});
