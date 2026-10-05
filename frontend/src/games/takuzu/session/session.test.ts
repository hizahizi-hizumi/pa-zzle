import type { TakuzuProblem } from "@/games/takuzu/problem/problem";
import { parseTakuzuBoard } from "@/games/takuzu/puzzle/board";
import {
  canUndoTakuzuSession,
  createTakuzuSession,
  cycleTakuzuSessionCell,
  getTakuzuSessionCellViews,
  getTakuzuSessionCorrectionCount,
  getTakuzuSessionLineViolations,
  getTakuzuSessionResult,
  placeTakuzuSessionCell,
  restartTakuzuSession,
  type TakuzuSession,
  undoTakuzuSession,
} from "@/games/takuzu/session/session";

const problem: TakuzuProblem = {
  givens: parseTakuzuBoard(["A..B", "....", "..A.", "B..."]),
  solution: parseTakuzuBoard(["AABB", "BBAA", "ABAB", "BABA"]),
};

function pressCells(
  session: TakuzuSession,
  cellIndices: readonly number[],
  operatedAt: number,
): TakuzuSession {
  return cellIndices.reduce(
    (current, cellIndex) =>
      cycleTakuzuSessionCell(current, cellIndex, "forward", operatedAt),
    session,
  );
}

/** 解のタイルになるまで各空きマスを押す手順。A は1回、B は2回押す。 */
function listSolvingPresses(target: TakuzuProblem): number[] {
  return target.givens.cells.flatMap((cell, cellIndex) => {
    if (cell !== null) {
      return [];
    }
    return target.solution.cells[cellIndex] === "a"
      ? [cellIndex]
      : [cellIndex, cellIndex];
  });
}

describe("createTakuzuSession", () => {
  test("初期配置からプレイを始めること", () => {
    const result = createTakuzuSession(problem, 100);

    expect(result.status).toBe("playing");
    expect(result.puzzleState).toBe(problem.givens);
    expect(result.startedAt).toBe(100);
  });
});

describe("cycleTakuzuSessionCell", () => {
  const session = createTakuzuSession(problem, 100);

  test("空きマスを押すとタイルを置いて入力回数を数えること", () => {
    const result = cycleTakuzuSessionCell(session, 1, "forward", 200);

    expect(result.puzzleState.cells[1]).toBe("a");
    expect(result.inputCount).toBe(1);
  });

  test("逆順の巡回で空きマスへ B を置くこと", () => {
    const result = cycleTakuzuSessionCell(session, 1, "backward", 200);

    expect(result.puzzleState.cells[1]).toBe("b");
  });

  test("固定マスを押しても何も記録しないこと", () => {
    const result = cycleTakuzuSessionCell(session, 0, "forward", 200);

    expect(result).toBe(session);
  });

  describe("全マスを解のとおりに埋めた場合", () => {
    const solvingPresses = listSolvingPresses(problem);

    test("クリアして終了時刻を記録すること", () => {
      const result = pressCells(session, solvingPresses, 5_100);

      expect(result.status).toBe("cleared");
      expect(result.finishedAt).toBe(5_100);
    });
  });

  describe("クリアした後の場合", () => {
    const cleared = pressCells(session, listSolvingPresses(problem), 5_100);

    test("入力を受け付けないこと", () => {
      const result = cycleTakuzuSessionCell(cleared, 1, "forward", 6_000);

      expect(result).toBe(cleared);
    });
  });
});

describe("placeTakuzuSessionCell", () => {
  const session = createTakuzuSession(problem, 100);

  test("空きマスへ B を直接置いて入力回数を数えること", () => {
    const result = placeTakuzuSessionCell(session, 1, "b", 200);

    expect(result.puzzleState.cells[1]).toBe("b");
    expect(result.inputCount).toBe(1);
  });

  test("すでに同じ中身のマスへの入力を記録しないこと", () => {
    const result = placeTakuzuSessionCell(session, 1, null, 200);

    expect(result).toBe(session);
  });

  describe("置いたマスへ戻って直接置き換えた場合", () => {
    const placed = [
      [1, "a"],
      [2, "b"],
      [1, "b"],
    ] as const;
    const replaced = placed.reduce(
      (current, [cellIndex, cell]) =>
        placeTakuzuSessionCell(current, cellIndex, cell, 200),
      session,
    );

    test("置き直しを1回と数えること", () => {
      const result = getTakuzuSessionCorrectionCount(replaced);

      expect(result).toBe(1);
    });
  });
});

describe("getTakuzuSessionCorrectionCount", () => {
  const session = createTakuzuSession(problem, 100);
  const cases = [
    ["空きマスへ置いて別のマスへ移る", [1, 2], 0],
    ["同じマスを続けて押して A から B にする", [1, 1, 2], 0],
    ["置いたマスへ戻って値を変える", [1, 2, 1], 1],
    ["置いたマスへ戻って空にする", [1, 2, 1, 1], 1],
    ["置いたマスへ戻って一周させ元の値に戻す", [1, 2, 1, 1, 1], 0],
    ["置いたマスへ戻って変え、さらに別のマスでも変える", [1, 2, 1, 2], 2],
  ] as const;

  test.each(cases)(
    "%s と %i 回の置き直しを数えること",
    (_, presses, expected) => {
      const result = getTakuzuSessionCorrectionCount(
        pressCells(session, presses, 200),
      );

      expect(result).toBe(expected);
    },
  );
});

describe("restartTakuzuSession", () => {
  const session = createTakuzuSession(problem, 100);

  describe("タイルを置いた盤面の場合", () => {
    const pressed = pressCells(session, [1, 2, 1], 200);
    const restarted = restartTakuzuSession(pressed);

    test("盤面を初期配置へ戻して盤面を戻した回数を数えること", () => {
      const result = restartTakuzuSession(pressed);

      expect(result.puzzleState).toBe(problem.givens);
      expect(result.restartCount).toBe(1);
      expect(result.startedAt).toBe(100);
    });

    test("盤面を戻す前の置き直しと入力回数を引き継ぐこと", () => {
      const result = restartTakuzuSession(pressed);

      expect(getTakuzuSessionCorrectionCount(result)).toBe(1);
      expect(result.inputCount).toBe(3);
    });

    test("盤面を戻して消えたマスへ置き直しても置き直しに数えないこと", () => {
      const result = pressCells(restarted, [1, 2], 300);

      expect(getTakuzuSessionCorrectionCount(result)).toBe(1);
    });
  });

  describe("初期配置のままの盤面の場合", () => {
    test("何も変えないこと", () => {
      const result = restartTakuzuSession(session);

      expect(result).toBe(session);
    });
  });
});

describe("undoTakuzuSession", () => {
  const session = createTakuzuSession(problem, 100);

  describe("タイルを置いた盤面の場合", () => {
    const pressed = pressCells(session, [1, 1], 200);

    test("直前の1操作だけを取り消して待った回数を数えること", () => {
      const result = undoTakuzuSession(pressed);
      expect(result.puzzleState.cells[1]).toBe("a");
      expect(result.undoCount).toBe(1);
      expect(result.inputCount).toBe(2);
    });

    test("操作をすべて取り消すと待ったできなくなること", () => {
      const result = undoTakuzuSession(undoTakuzuSession(pressed));
      expect(result.puzzleState).toBe(problem.givens);
      expect(canUndoTakuzuSession(result)).toBe(false);
    });
  });

  describe("置き直しを取り消した場合", () => {
    const corrected = pressCells(session, [1, 2, 1], 200);
    const undone = undoTakuzuSession(corrected);

    test("取り消した置き直しを数えないこと", () => {
      expect(getTakuzuSessionCorrectionCount(corrected)).toBe(1);
      expect(getTakuzuSessionCorrectionCount(undone)).toBe(0);
    });

    test("取り消した後に同じマスを置き直すと改めて数えること", () => {
      const result = pressCells(undone, [1], 300);
      expect(getTakuzuSessionCorrectionCount(result)).toBe(1);
    });
  });

  describe("盤面を戻した後の場合", () => {
    const restarted = restartTakuzuSession(pressCells(session, [1, 2], 200));

    test("盤面を戻す前の操作は取り消せないこと", () => {
      expect(canUndoTakuzuSession(restarted)).toBe(false);
      expect(undoTakuzuSession(restarted)).toBe(restarted);
    });
  });

  describe("操作していない場合", () => {
    test("何も変えないこと", () => {
      expect(canUndoTakuzuSession(session)).toBe(false);
      expect(undoTakuzuSession(session)).toBe(session);
    });
  });

  describe("クリアした後の場合", () => {
    const cleared = pressCells(session, listSolvingPresses(problem), 5_100);

    test("取り消せないこと", () => {
      expect(canUndoTakuzuSession(cleared)).toBe(false);
      expect(undoTakuzuSession(cleared)).toBe(cleared);
    });
  });
});

describe("getTakuzuSessionResult", () => {
  const session = createTakuzuSession(problem, 100);

  test("プレイ中は結果を返さないこと", () => {
    const result = getTakuzuSessionResult(session);

    expect(result).toBeNull();
  });

  describe("盤面を戻してから置き直しを経てクリアした場合", () => {
    const restarted = restartTakuzuSession(pressCells(session, [1], 200));
    const withCorrection = pressCells(restarted, [5, 6, 5], 300);
    const cleared = pressCells(
      withCorrection,
      listSolvingPresses({ ...problem, givens: withCorrection.puzzleState }),
      2_100,
    );

    test("経過時間・置き直し・盤面を戻した回数・入力回数を返すこと", () => {
      const result = getTakuzuSessionResult(cleared);

      expect(result).toEqual({
        elapsedMs: 2_000,
        correctionCount: 1,
        restartCount: 1,
        undoCount: 0,
        inputCount: cleared.inputCount,
      });
    });
  });
});

describe("getTakuzuSessionCellViews", () => {
  const session = pressCells(createTakuzuSession(problem, 100), [1, 2], 200);

  test("固定マスと3連続のマスを示すこと", () => {
    const result = getTakuzuSessionCellViews(session);

    expect(result.slice(0, 4)).toEqual([
      { cell: "a", given: true, inViolatingRun: true },
      { cell: "a", given: false, inViolatingRun: true },
      { cell: "a", given: false, inViolatingRun: true },
      { cell: "b", given: true, inViolatingRun: false },
    ]);
    expect(result[4]).toEqual({
      cell: null,
      given: false,
      inViolatingRun: false,
    });
  });
});

describe("getTakuzuSessionLineViolations", () => {
  const session = createTakuzuSession(problem, 100);

  describe("行に同じタイルが半数を超えた場合", () => {
    const overfilled = pressCells(session, [1, 2], 200);

    test("その行を個数超過として示すこと", () => {
      const result = getTakuzuSessionLineViolations(overfilled);

      expect(result).toEqual([
        { axis: "row", index: 0, overfilled: true, duplicated: false },
      ]);
    });
  });

  describe("埋まった列どうしが同じ並びになった場合", () => {
    const duplicated = pressCells(session, [4, 8, 8, 1, 5, 9, 9, 13, 13], 200);

    test("両方の列を重複として示すこと", () => {
      const result = getTakuzuSessionLineViolations(duplicated);

      expect(result).toEqual([
        { axis: "column", index: 0, overfilled: false, duplicated: true },
        { axis: "column", index: 1, overfilled: false, duplicated: true },
      ]);
    });
  });

  describe("違反の無い盤面の場合", () => {
    test("何も示さないこと", () => {
      const result = getTakuzuSessionLineViolations(session);

      expect(result).toEqual([]);
    });
  });
});
