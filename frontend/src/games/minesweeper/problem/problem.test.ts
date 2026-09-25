import { restoreMinesweeperProblemWithoutAnalysis } from "./generator";
import {
  countMinesweeperMinimumOpenCount,
  type MinesweeperProblem,
} from "./problem";

describe("countMinesweeperMinimumOpenCount", () => {
  // 0 1 * 1 0
  const board = { rows: 1, columns: 5, mineCellIndices: [2] };

  test("未開示の0のマスは連鎖で開く範囲ごとに1回と数えること", () => {
    const problem: MinesweeperProblem = {
      board,
      initialRevealedCellIndices: [],
    };

    expect(countMinesweeperMinimumOpenCount(problem)).toBe(2);
  });

  test("初期開示済みのマスを数えないこと", () => {
    const problem: MinesweeperProblem = {
      board,
      initialRevealedCellIndices: [0, 1],
    };

    expect(countMinesweeperMinimumOpenCount(problem)).toBe(1);
  });

  test("0の連鎖に含まれない数字のマスは1マスごとに1回と数えること", () => {
    const problem: MinesweeperProblem = {
      board: { rows: 1, columns: 5, mineCellIndices: [0, 2, 4] },
      initialRevealedCellIndices: [1],
    };

    expect(countMinesweeperMinimumOpenCount(problem)).toBe(1);
  });

  test("同じ再現用情報から復元した問題では同じ回数になること", () => {
    const identity = {
      generatorVersion: "1",
      seed: "minimum-open-count",
      conditions: {
        rows: 10,
        columns: 10,
        mineCount: 15,
        startCellPlacement: "random",
      },
      generationAttempt: 1,
    } as const;

    const first = countMinesweeperMinimumOpenCount(
      restoreMinesweeperProblemWithoutAnalysis(identity).problem,
    );
    const second = countMinesweeperMinimumOpenCount(
      restoreMinesweeperProblemWithoutAnalysis(identity).problem,
    );

    expect(first).toBeGreaterThan(0);
    expect(second).toBe(first);
  });
});
