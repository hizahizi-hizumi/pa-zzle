import type { NanpureProblem } from "../problem/problem";
import type { NanpureCell } from "../puzzle/board";
import { findNanpureConflictCellIndices } from "../puzzle/rules";
import {
  canUndoNanpureSession,
  clearNanpureCell,
  createNanpureSession,
  enterNanpureDigit,
  findCompletedNanpureDigits,
  findNanpureMistakeCellIndices,
  getNanpureSessionElapsedMs,
  getNanpureSessionResult,
  type NanpureSession,
  restartNanpureSession,
  toggleNanpureNote,
  undoNanpureSession,
} from "./session";

function boardFromRows(rows: readonly string[]): NanpureCell[] {
  return rows.flatMap((row) =>
    [...row].map<NanpureCell>((cell) =>
      cell === "0" ? null : (Number(cell) as NanpureCell),
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

function createProblem(): NanpureProblem {
  const clues = [...solution];
  clues[0] = null;
  clues[1] = null;
  return { clues, solution: solution as NanpureProblem["solution"] };
}

function createProblemWithAdditionalEmptyCells(
  ...cellIndices: readonly number[]
): NanpureProblem {
  const problem = createProblem();
  const clues = [...problem.clues];
  for (const cellIndex of cellIndices) {
    clues[cellIndex] = null;
  }
  return { ...problem, clues };
}

describe("createNanpureSession", () => {
  const problem = createProblem();
  const invalidProblem = (() => {
    const clues = [...problem.clues];
    clues[2] = 9;
    return { ...problem, clues };
  })();

  test("初期ヒントからプレイ状態を作ること", () => {
    const session = createNanpureSession(problem, 1_000);

    expect(session.board).toEqual(problem.clues);
    expect(session.notes).toHaveLength(81);
    expect(session.status).toBe("playing");
    expect(session.mistakeCount).toBe(0);
  });

  test("完成解と一致しない初期ヒントを拒否すること", () => {
    const act = () => createNanpureSession(invalidProblem, 1_000);

    expect(act).toThrow("Nanpure problem clues must match its solution");
  });
});

describe("enterNanpureDigit", () => {
  describe("競合しない誤答を入力する場合", () => {
    const problem = createProblemWithAdditionalEmptyCells(72);
    let session: NanpureSession;

    beforeEach(() => {
      session = createNanpureSession(problem, 1_000);
    });

    test("完成解との不一致からミスとして記録すること", () => {
      const next = enterNanpureDigit(session, 0, 3, 2_000);
      const conflicts = findNanpureConflictCellIndices(next.board);
      const mistakes = findNanpureMistakeCellIndices(next);

      expect(next.board[0]).toBe(3);
      expect(conflicts).toEqual([]);
      expect(mistakes).toEqual([0]);
      expect(next.mistakeCount).toBe(1);
      expect(next.status).toBe("playing");
    });
  });

  describe("初期ヒントを入力対象にする場合", () => {
    let session: NanpureSession;

    beforeEach(() => {
      session = createNanpureSession(createProblem(), 1_000);
    });

    test("初期ヒントを変更しないこと", () => {
      const next = enterNanpureDigit(session, 2, 4, 2_000);

      expect(next).toBe(session);
    });
  });

  describe("関連マスに手動メモがある場合", () => {
    const problem = createProblemWithAdditionalEmptyCells(9);
    let session: NanpureSession;

    beforeEach(() => {
      session = createNanpureSession(problem, 1_000);
      session = toggleNanpureNote(session, 9, 3);
    });

    test("誤答では関連マスの手動メモを消さないこと", () => {
      const answered = enterNanpureDigit(session, 0, 3, 2_000);

      expect(answered.notes[9]).toEqual([3]);
      expect(answered.mistakeCount).toBe(1);
    });
  });

  describe("最後の空きマスだけ残っている場合", () => {
    let session: NanpureSession;

    beforeEach(() => {
      session = createNanpureSession(createProblem(), 1_000);
      session = enterNanpureDigit(session, 0, 5, 2_000);
    });

    test("最後の正解入力で自動的にクリアすること", () => {
      const cleared = enterNanpureDigit(session, 1, 3, 2_500);

      expect(cleared.status).toBe("cleared");
      expect(cleared.finishedAt).toBe(2_500);
    });
  });
});

describe("toggleNanpureNote", () => {
  describe("空きマスの場合", () => {
    let session: NanpureSession;

    beforeEach(() => {
      session = createNanpureSession(createProblem(), 1_000);
    });

    test("手動メモを追加して削除できること", () => {
      const added = toggleNanpureNote(session, 0, 4);
      const removed = toggleNanpureNote(added, 0, 4);

      expect(added.notes[0]).toEqual([4]);
      expect(removed.notes[0]).toEqual([]);
      expect(removed.mistakeCount).toBe(0);
    });
  });

  describe("同じ数字の手動メモが関連マスにある場合", () => {
    const problem = createProblemWithAdditionalEmptyCells(9, 10, 40);
    let session: NanpureSession;

    beforeEach(() => {
      session = createNanpureSession(problem, 1_000);
      session = toggleNanpureNote(session, 0, 4);
      session = toggleNanpureNote(session, 1, 5);
      session = toggleNanpureNote(session, 1, 8);
      session = toggleNanpureNote(session, 9, 5);
      session = toggleNanpureNote(session, 9, 7);
      session = toggleNanpureNote(session, 10, 2);
      session = toggleNanpureNote(session, 10, 5);
      session = toggleNanpureNote(session, 40, 5);
    });

    test("回答入力した数字を同じマスと関連マスの手動メモから消すこと", () => {
      const answered = enterNanpureDigit(session, 0, 5, 2_000);

      expect(answered.notes[0]).toEqual([]);
      expect(answered.notes[1]).toEqual([8]);
      expect(answered.notes[9]).toEqual([7]);
      expect(answered.notes[10]).toEqual([2]);
      expect(answered.notes[40]).toEqual([5]);
    });
  });
});

describe("findCompletedNanpureDigits", () => {
  const problem = createProblemWithAdditionalEmptyCells(6);
  let beforeCorrectEntry: NanpureSession;
  let afterCorrectEntry: NanpureSession;

  beforeEach(() => {
    beforeCorrectEntry = createNanpureSession(problem, 1_000);
    beforeCorrectEntry = enterNanpureDigit(beforeCorrectEntry, 0, 9, 2_000);
    afterCorrectEntry = enterNanpureDigit(beforeCorrectEntry, 6, 9, 2_500);
  });

  test("誤答を含めて9個見えても正解が揃っていない数字は完了扱いにしないこと", () => {
    const before = findCompletedNanpureDigits(beforeCorrectEntry);
    const after = findCompletedNanpureDigits(afterCorrectEntry);

    expect(before).not.toContain(9);
    expect(after).toContain(9);
  });
});

describe("undoNanpureSession", () => {
  describe("誤答前に手動メモがある場合", () => {
    let session: NanpureSession;

    beforeEach(() => {
      session = createNanpureSession(createProblem(), 1_000);
      session = toggleNanpureNote(session, 0, 4);
      session = enterNanpureDigit(session, 0, 4, 2_000);
    });

    test("盤面と手動メモを戻してミス履歴は減らさないこと", () => {
      const undone = undoNanpureSession(session);

      expect(undone.board[0]).toBeNull();
      expect(undone.notes[0]).toEqual([4]);
      expect(undone.mistakeCount).toBe(1);
      expect(undone.undoCount).toBe(1);
    });
  });

  describe("正解入力の履歴がある場合", () => {
    let session: NanpureSession;

    beforeEach(() => {
      session = createNanpureSession(createProblem(), 1_000);
      session = enterNanpureDigit(session, 0, 5, 2_000);
    });

    test("正解入力を戻すと待っただけを増やすこと", () => {
      const undone = undoNanpureSession(session);

      expect(undone.mistakeCount).toBe(0);
      expect(undone.undoCount).toBe(1);
    });
  });

  describe("履歴が空の場合", () => {
    let session: NanpureSession;

    beforeEach(() => {
      session = createNanpureSession(createProblem(), 1_000);
    });

    test("操作できないこと", () => {
      const undone = undoNanpureSession(session);
      const canUndo = canUndoNanpureSession(undone);

      expect(undone).toBe(session);
      expect(canUndo).toBe(false);
    });
  });
});

describe("clearNanpureCell", () => {
  describe("プレイヤーが回答を入力している場合", () => {
    let session: NanpureSession;

    beforeEach(() => {
      session = createNanpureSession(createProblem(), 1_000);
      session = enterNanpureDigit(session, 0, 4, 2_000);
    });

    test("プレイヤーが入力した回答を削除できること", () => {
      const erased = clearNanpureCell(session, 0);

      expect(erased.board[0]).toBeNull();
    });
  });

  describe("手動メモだけを入力している場合", () => {
    let session: NanpureSession;

    beforeEach(() => {
      session = createNanpureSession(createProblem(), 1_000);
      session = toggleNanpureNote(session, 0, 4);
    });

    test("マスを空にできること", () => {
      const cleared = clearNanpureCell(session, 0);

      expect(cleared.board[0]).toBeNull();
      expect(cleared.notes[0]).toEqual([]);
    });
  });
});

describe("restartNanpureSession", () => {
  let session: NanpureSession;

  beforeEach(() => {
    session = createNanpureSession(createProblem(), 1_000);
    session = enterNanpureDigit(session, 0, 4, 2_000);
    session = undoNanpureSession(session);
    session = toggleNanpureNote(session, 0, 4);
  });

  test("同じプレイの計測を保ったまま初期盤面へ戻すこと", () => {
    const restarted = restartNanpureSession(session);

    expect(restarted.board).toEqual(session.problem.clues);
    expect(restarted.notes[0]).toEqual([]);
    expect(restarted.history).toEqual([]);
    expect(restarted.mistakeCount).toBe(1);
    expect(restarted.undoCount).toBe(1);
    expect(restarted.restartCount).toBe(1);
    expect(restarted.startedAt).toBe(1_000);
  });
});

describe("getNanpureSessionResult", () => {
  let clearedSession: NanpureSession;

  beforeEach(() => {
    clearedSession = createNanpureSession(createProblem(), 1_000);
    clearedSession = enterNanpureDigit(clearedSession, 0, 5, 2_000);
    clearedSession = enterNanpureDigit(clearedSession, 1, 3, 4_500);
  });

  test("クリア時点の経過時間と成績生データを返すこと", () => {
    const elapsedMs = getNanpureSessionElapsedMs(clearedSession, 9_000);
    const result = getNanpureSessionResult(clearedSession, 9_000);

    expect(elapsedMs).toBe(3_500);
    expect(result).toEqual({
      elapsedMs: 3_500,
      mistakeCount: 0,
      undoCount: 0,
      restartCount: 0,
    });
  });
});
