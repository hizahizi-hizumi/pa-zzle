import type { MinesweeperProblem } from "../problem/problem";
import {
  chordMinesweeperSessionCell,
  createMinesweeperSession,
  getMinesweeperSessionElapsedMs,
  getMinesweeperSessionResult,
  getMinesweeperSessionVisibleCells,
  revealMinesweeperSessionCell,
  toggleMinesweeperSessionFlag,
} from "./session";

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
    expect(result.mistakeCount).toBe(0);
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

  test("地雷を開示してもプレイを続け、ミスとして数えること", () => {
    const result = revealMinesweeperSessionCell(initialSession, 0, 200);

    expect(result.status).toBe("playing");
    expect(result.finishedAt).toBeNull();
    expect(result.mistakeCount).toBe(1);
    expect(getMinesweeperSessionVisibleCells(result)[0]).toEqual({
      state: "steppedMine",
    });
  });

  test("踏んだ地雷以外の地雷配置を示さないこと", () => {
    const twoMineSession = createMinesweeperSession(
      {
        board: { rows: 2, columns: 3, mineCellIndices: [0, 2] },
        initialRevealedCellIndices: [1],
      },
      100,
    );
    const result = revealMinesweeperSessionCell(twoMineSession, 0, 200);

    expect(getMinesweeperSessionVisibleCells(result)[2]).toEqual({
      state: "hidden",
    });
  });

  test("地雷を踏んだ後も全安全マスを開けばクリアすること", () => {
    const stepped = revealMinesweeperSessionCell(initialSession, 0, 200);
    const result = chordMinesweeperSessionCell(stepped, 1, 300);

    expect(result.status).toBe("cleared");
    expect(result.finishedAt).toBe(300);
    expect(result.mistakeCount).toBe(1);
  });

  test("chordで複数の地雷を踏むと踏んだ数だけミスを数えること", () => {
    const twoMineSession = createMinesweeperSession(
      {
        board: { rows: 2, columns: 3, mineCellIndices: [0, 2] },
        initialRevealedCellIndices: [1],
      },
      100,
    );
    const flagged = toggleMinesweeperSessionFlag(
      toggleMinesweeperSessionFlag(twoMineSession, 3),
      5,
    );
    const result = chordMinesweeperSessionCell(flagged, 1, 200);

    expect(result.mistakeCount).toBe(2);
    expect(result.status).toBe("playing");
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

describe("getMinesweeperSessionElapsedMs", () => {
  const problem: MinesweeperProblem = {
    board: {
      rows: 2,
      columns: 3,
      mineCellIndices: [0],
    },
    initialRevealedCellIndices: [1],
  };

  test("プレイ中は現在時刻までの経過時間を返すこと", () => {
    const session = createMinesweeperSession(problem, 1_000);

    expect(getMinesweeperSessionElapsedMs(session, 4_500)).toBe(3_500);
  });

  test("クリア後はクリア時点で経過時間を止めること", () => {
    const cleared = chordMinesweeperSessionCell(
      toggleMinesweeperSessionFlag(createMinesweeperSession(problem, 1_000), 0),
      1,
      3_000,
    );

    expect(getMinesweeperSessionElapsedMs(cleared, 9_000)).toBe(2_000);
  });
});

describe("getMinesweeperSessionResult", () => {
  // 0 1 * 1 0
  const problem: MinesweeperProblem = {
    board: { rows: 1, columns: 5, mineCellIndices: [2] },
    initialRevealedCellIndices: [0, 1],
  };

  test("クリア前は結果を返さないこと", () => {
    const session = createMinesweeperSession(problem, 1_000);

    expect(getMinesweeperSessionResult(session, 5_000)).toBeNull();
  });

  test("クリアしたプレイの経過時間・ミス数・開く操作の最小回数を返すこと", () => {
    const stepped = revealMinesweeperSessionCell(
      createMinesweeperSession(problem, 1_000),
      2,
      2_000,
    );
    const cleared = revealMinesweeperSessionCell(stepped, 4, 4_000);

    expect(getMinesweeperSessionResult(cleared, 9_000)).toEqual({
      elapsedMs: 3_000,
      mistakeCount: 1,
      minimumOpenCount: 1,
    });
  });
});
