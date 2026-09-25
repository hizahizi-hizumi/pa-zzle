import type { TakuzuProblem } from "@/games/takuzu/problem/problem";
import { parseTakuzuBoard } from "@/games/takuzu/puzzle/board";
import {
  createTakuzuSession,
  cycleTakuzuSessionCell,
  getTakuzuSessionCellViews,
  getTakuzuSessionCorrectionCount,
  getTakuzuSessionResult,
  restartTakuzuSession,
  type TakuzuSession,
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
    expect(result.board).toBe(problem.givens);
    expect(result.startedAt).toBe(100);
  });
});

describe("cycleTakuzuSessionCell", () => {
  const session = createTakuzuSession(problem, 100);

  test("空きマスを押すとタイルを置いて入力回数を数えること", () => {
    const result = cycleTakuzuSessionCell(session, 1, "forward", 200);

    expect(result.board.cells[1]).toBe("a");
    expect(result.inputCount).toBe(1);
  });

  test("逆順の巡回で空きマスへ B を置くこと", () => {
    const result = cycleTakuzuSessionCell(session, 1, "backward", 200);

    expect(result.board.cells[1]).toBe("b");
  });

  test("固定マスを押しても何も記録しないこと", () => {
    const result = cycleTakuzuSessionCell(session, 0, "forward", 200);

    expect(result).toBe(session);
  });

  describe("全マスを解のとおりに埋めた場合", () => {
    const solvingPresses = listSolvingPresses(problem);
    const cleared = pressCells(session, solvingPresses, 5_100);

    test("クリアして終了時刻を記録すること", () => {
      const result = pressCells(session, solvingPresses, 5_100);

      expect(result.status).toBe("cleared");
      expect(result.finishedAt).toBe(5_100);
    });

    test("クリア後の入力を受け付けないこと", () => {
      const result = cycleTakuzuSessionCell(cleared, 1, "forward", 6_000);

      expect(result).toBe(cleared);
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

    test("盤面を初期配置へ戻してやり直し回数を数えること", () => {
      const result = restartTakuzuSession(pressed);

      expect(result.board).toBe(problem.givens);
      expect(result.restartCount).toBe(1);
      expect(result.startedAt).toBe(100);
    });

    test("やり直し前の置き直しと入力回数を引き継ぐこと", () => {
      const result = restartTakuzuSession(pressed);

      expect(getTakuzuSessionCorrectionCount(result)).toBe(1);
      expect(result.inputCount).toBe(3);
    });

    test("やり直しで消えたマスへ置き直しても置き直しに数えないこと", () => {
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

describe("getTakuzuSessionResult", () => {
  const session = createTakuzuSession(problem, 100);

  test("プレイ中は結果を返さないこと", () => {
    const result = getTakuzuSessionResult(session);

    expect(result).toBeNull();
  });

  describe("やり直しと置き直しを経てクリアした場合", () => {
    const restarted = restartTakuzuSession(pressCells(session, [1], 200));
    const withCorrection = pressCells(restarted, [5, 6, 5], 300);
    const cleared = pressCells(
      withCorrection,
      listSolvingPresses({ ...problem, givens: withCorrection.board }),
      2_100,
    );

    test("経過時間・置き直し・やり直し・入力回数を返すこと", () => {
      const result = getTakuzuSessionResult(cleared);

      expect(result).toEqual({
        elapsedMs: 2_000,
        correctionCount: 1,
        restartCount: 1,
        inputCount: cleared.inputCount,
      });
    });
  });
});

describe("getTakuzuSessionCellViews", () => {
  const session = pressCells(createTakuzuSession(problem, 100), [1, 2], 200);

  test("固定マスとルール違反のマスを示すこと", () => {
    const result = getTakuzuSessionCellViews(session);

    expect(result.slice(0, 4)).toEqual([
      { cell: "a", given: true, violated: true },
      { cell: "a", given: false, violated: true },
      { cell: "a", given: false, violated: true },
      { cell: "b", given: true, violated: true },
    ]);
    expect(result[4]).toEqual({ cell: null, given: false, violated: false });
  });
});
