import { describe, expect, test } from "vitest";

import {
  canUndoSudokuSession,
  createSudokuSession,
  enterSudokuDigit,
  eraseSudokuDigit,
  getSudokuSessionElapsedMs,
  getSudokuSessionResult,
  restartSudokuSession,
  toggleSudokuNote,
  undoSudokuSession,
} from "./session";
import type { SudokuCell, SudokuProblem } from "./state";

function boardFromRows(rows: readonly string[]): SudokuCell[] {
  return rows.flatMap((row) =>
    [...row].map<SudokuCell>((cell) =>
      cell === "0" ? null : (Number(cell) as SudokuCell),
    ),
  );
}

const solution = boardFromRows([
  "534678912",
  "672195348",
  "198342567",
  "859761423",
  "426853791",
  "713924856",
  "961537284",
  "287419635",
  "345286179",
]);

function createProblem(): SudokuProblem {
  const clues = [...solution];
  clues[0] = null;
  clues[1] = null;
  return { clues, solution: solution as SudokuProblem["solution"] };
}

describe("createSudokuSession", () => {
  test("初期ヒントからプレイ状態を作ること", () => {
    const problem = createProblem();

    const session = createSudokuSession(problem, 1_000);

    expect(session.board).toEqual(problem.clues);
    expect(session.notes).toHaveLength(81);
    expect(session.status).toBe("playing");
    expect(session.mistakeCount).toBe(0);
  });

  test("完成解と一致しない初期ヒントを拒否すること", () => {
    const problem = createProblem();
    const clues = [...problem.clues];
    clues[2] = 9;
    const act = () => createSudokuSession({ ...problem, clues }, 1_000);

    expect(act).toThrow("Sudoku problem clues must match its solution");
  });
});

describe("enterSudokuDigit", () => {
  test("誤答を受理してミスとして記録すること", () => {
    const session = createSudokuSession(createProblem(), 1_000);

    const next = enterSudokuDigit(session, 0, 4, 2_000);

    expect(next.board[0]).toBe(4);
    expect(next.mistakeCount).toBe(1);
    expect(next.status).toBe("playing");
  });

  test("初期ヒントを変更しないこと", () => {
    const session = createSudokuSession(createProblem(), 1_000);

    const next = enterSudokuDigit(session, 2, 4, 2_000);

    expect(next).toBe(session);
  });

  test("最後の正解入力で自動的にクリアすること", () => {
    const problem = createProblem();
    let session = createSudokuSession(problem, 1_000);
    session = enterSudokuDigit(session, 0, 5, 2_000);

    const cleared = enterSudokuDigit(session, 1, 3, 2_500);

    expect(cleared.status).toBe("cleared");
    expect(cleared.finishedAt).toBe(2_500);
  });
});

describe("toggleSudokuNote", () => {
  test("空きマスの手動メモを追加して削除できること", () => {
    const session = createSudokuSession(createProblem(), 1_000);

    const added = toggleSudokuNote(session, 0, 4);
    const removed = toggleSudokuNote(added, 0, 4);

    expect(added.notes[0]).toEqual([4]);
    expect(removed.notes[0]).toEqual([]);
    expect(removed.mistakeCount).toBe(0);
  });

  test("回答入力した数字を同じマスと関連マスの手動メモから消すこと", () => {
    const problem = createProblem();
    const clues = [...problem.clues];
    clues[9] = null;
    clues[10] = null;
    clues[40] = null;
    let session = createSudokuSession({ ...problem, clues }, 1_000);
    session = toggleSudokuNote(session, 0, 4);
    session = toggleSudokuNote(session, 1, 5);
    session = toggleSudokuNote(session, 1, 8);
    session = toggleSudokuNote(session, 9, 5);
    session = toggleSudokuNote(session, 9, 7);
    session = toggleSudokuNote(session, 10, 2);
    session = toggleSudokuNote(session, 10, 5);
    session = toggleSudokuNote(session, 40, 5);

    const answered = enterSudokuDigit(session, 0, 5, 2_000);

    expect(answered.notes[0]).toEqual([]);
    expect(answered.notes[1]).toEqual([8]);
    expect(answered.notes[9]).toEqual([7]);
    expect(answered.notes[10]).toEqual([2]);
    expect(answered.notes[40]).toEqual([5]);
  });
});

describe("undoSudokuSession", () => {
  test("盤面と手動メモを戻してミス履歴は減らさないこと", () => {
    let session = createSudokuSession(createProblem(), 1_000);
    session = toggleSudokuNote(session, 0, 4);
    session = enterSudokuDigit(session, 0, 4, 2_000);

    const undone = undoSudokuSession(session);

    expect(undone.board[0]).toBeNull();
    expect(undone.notes[0]).toEqual([4]);
    expect(undone.mistakeCount).toBe(1);
    expect(undone.undoCount).toBe(1);
  });

  test("履歴が空なら操作できないこと", () => {
    const session = createSudokuSession(createProblem(), 1_000);

    const undone = undoSudokuSession(session);

    expect(undone).toBe(session);
    expect(canUndoSudokuSession(undone)).toBe(false);
  });
});

describe("eraseSudokuDigit", () => {
  test("プレイヤーが入力した回答を削除できること", () => {
    const session = enterSudokuDigit(
      createSudokuSession(createProblem(), 1_000),
      0,
      4,
      2_000,
    );

    const erased = eraseSudokuDigit(session, 0);

    expect(erased.board[0]).toBeNull();
  });
});

describe("restartSudokuSession", () => {
  test("同じプレイの計測を保ったまま初期盤面へ戻すこと", () => {
    let session = createSudokuSession(createProblem(), 1_000);
    session = enterSudokuDigit(session, 0, 4, 2_000);
    session = undoSudokuSession(session);
    session = toggleSudokuNote(session, 0, 4);

    const restarted = restartSudokuSession(session);

    expect(restarted.board).toEqual(session.problem.clues);
    expect(restarted.notes[0]).toEqual([]);
    expect(restarted.history).toEqual([]);
    expect(restarted.mistakeCount).toBe(1);
    expect(restarted.undoCount).toBe(1);
    expect(restarted.restartCount).toBe(1);
    expect(restarted.startedAt).toBe(1_000);
  });
});

describe("getSudokuSessionResult", () => {
  test("クリア時点の経過時間と成績生データを返すこと", () => {
    let session = createSudokuSession(createProblem(), 1_000);
    session = enterSudokuDigit(session, 0, 5, 2_000);
    session = enterSudokuDigit(session, 1, 3, 4_500);

    const elapsedMs = getSudokuSessionElapsedMs(session, 9_000);
    const result = getSudokuSessionResult(session, 9_000);

    expect(elapsedMs).toBe(3_500);
    expect(result).toEqual({
      elapsedMs: 3_500,
      mistakeCount: 0,
      undoCount: 0,
      restartCount: 0,
    });
  });
});
