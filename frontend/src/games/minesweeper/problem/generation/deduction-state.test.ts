import {
  applyMinesweeperDeduction,
  collectMinesweeperNumberConstraints,
  createMinesweeperDeductionState,
} from "./deduction-state";

describe("collectMinesweeperNumberConstraints", () => {
  describe("既知地雷に隣接する数字がある場合", () => {
    const state = {
      ...createMinesweeperDeductionState({
        board: { rows: 2, columns: 3, mineCellIndices: [0, 2] },
        initialRevealedCellIndices: [3, 4, 5],
      }),
      knownMineCellIndices: new Set([0]),
    };

    test("既知地雷を除いた未確定マスと残り地雷数で制約を表し、同じ未確定マス集合の制約をまとめること", () => {
      const result = collectMinesweeperNumberConstraints(state);

      expect(result).toEqual([
        { cellIndices: [1], mineCount: 0 },
        { cellIndices: [1, 2], mineCount: 1 },
      ]);
    });
  });
});

describe("applyMinesweeperDeduction", () => {
  const state = createMinesweeperDeductionState({
    board: { rows: 3, columns: 3, mineCellIndices: [0] },
    initialRevealedCellIndices: [1],
  });
  const deduction = { safeCellIndices: [8], mineCellIndices: [0] };

  test("安全マスを0連鎖込みで開示し、地雷を既知地雷として記録すること", () => {
    const result = applyMinesweeperDeduction(state, deduction);

    expect([...result.revealedCellIndices].sort()).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect([...result.knownMineCellIndices]).toEqual([0]);
  });
});
