import type { MinesweeperProblem } from "@/games/minesweeper/problem/problem";
import {
  chordMinesweeperSessionCell,
  createMinesweeperSession,
  getMinesweeperSessionVisibleCells,
  revealMinesweeperSessionCell,
  toggleMinesweeperSessionFlag,
} from "@/games/minesweeper/session/session";

describe("createMinesweeperSession", () => {
  const problem: MinesweeperProblem = {
    board: {
      rows: 2,
      columns: 3,
      mineCellIndices: [0],
    },
    initialRevealedCellIndices: [1],
  };

  test("問題の初期開示状態からプレイを開始すること", () => {
    const result = createMinesweeperSession(problem, 100);

    expect(result.status).toBe("playing");
    expect(result.puzzleState.revealedCellIndices).toEqual([1]);
    expect(result.startedAt).toBe(100);
  });
});

describe("MinesweeperSession operations", () => {
  const problem: MinesweeperProblem = {
    board: {
      rows: 2,
      columns: 3,
      mineCellIndices: [0],
    },
    initialRevealedCellIndices: [1],
  };
  const initialSession = createMinesweeperSession(problem, 100);

  test("旗付きマスを通常開示しないこと", () => {
    const flagged = toggleMinesweeperSessionFlag(initialSession, 0);
    const result = revealMinesweeperSessionCell(flagged, 0, 200);

    expect(result).toBe(flagged);
  });

  test("地雷を開示すると失敗を確定すること", () => {
    const result = revealMinesweeperSessionCell(initialSession, 0, 200);

    expect(result.status).toBe("failed");
    expect(result.finishedAt).toBe(200);
    expect(result.puzzleState.explodedCellIndex).toBe(0);
  });

  test("正しい旗からchordして全安全マスを開くとクリアすること", () => {
    const flagged = toggleMinesweeperSessionFlag(initialSession, 0);
    const result = chordMinesweeperSessionCell(flagged, 1, 300);

    expect(result.status).toBe("cleared");
    expect(result.finishedAt).toBe(300);
  });

  test("クリア後は未旗の地雷を結果として表示できること", () => {
    const cleared = chordMinesweeperSessionCell(
      toggleMinesweeperSessionFlag(initialSession, 0),
      1,
      300,
    );
    const unflaggedCleared = {
      ...cleared,
      puzzleState: {
        ...cleared.puzzleState,
        flaggedCellIndices: [],
      },
    };
    const result = getMinesweeperSessionVisibleCells(unflaggedCleared);

    expect(result[0]).toEqual({ state: "mine" });
  });
});
