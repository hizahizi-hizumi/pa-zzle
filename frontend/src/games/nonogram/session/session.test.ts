import { createNonogramProblem } from "@/games/nonogram/problem/problem";
import {
  type NonogramBoard,
  parseNonogramBoard,
} from "@/games/nonogram/puzzle/board";
import { parseNonogramPattern } from "@/games/nonogram/puzzle/pattern";
import {
  canRestartNonogramSession,
  canUndoNonogramSession,
  createNonogramSession,
  endNonogramSessionStroke,
  extendNonogramSessionStroke,
  getNonogramSessionRepaintCount,
  getNonogramSessionResult,
  getNonogramSessionStrokeRange,
  type NonogramMark,
  type NonogramSession,
  restartNonogramSession,
  startNonogramSessionStroke,
  undoNonogramSession,
} from "@/games/nonogram/session/session";

const problem = createNonogramProblem(
  parseNonogramPattern(["#.#", "###", ".#."]),
);
const startedAt = 1_000;

function formatBoard(board: NonogramBoard): string[] {
  const notation = { unknown: ".", filled: "#", crossed: "x" } as const;
  return Array.from({ length: board.height }, (_, row) =>
    board.cells
      .slice(row * board.width, (row + 1) * board.width)
      .map((state) => notation[state])
      .join(""),
  );
}

function withBoard(rows: readonly string[]): NonogramSession {
  return {
    ...createNonogramSession(problem, startedAt),
    puzzleState: parseNonogramBoard(rows),
  };
}

function tap(
  session: NonogramSession,
  cellIndex: number,
  mark: NonogramMark,
): NonogramSession {
  return endNonogramSessionStroke(
    startNonogramSessionStroke(session, cellIndex, mark, startedAt),
  );
}

function drag(
  session: NonogramSession,
  cellIndices: readonly [number, ...number[]],
  mark: NonogramMark,
): NonogramSession {
  const [start, ...rest] = cellIndices;
  let next = startNonogramSessionStroke(session, start, mark, startedAt);
  for (const cellIndex of rest) {
    next = extendNonogramSessionStroke(next, cellIndex, startedAt);
  }
  return next;
}

const clearedAt = 61_000;
const almostSolved = withBoard(["#x#", "###", "x.."]);
const cleared = startNonogramSessionStroke(
  almostSolved,
  7,
  "filled",
  clearedAt,
);

describe("createNonogramSession", () => {
  test("全マスが未確定のプレイ中の session を作ること", () => {
    const session = createNonogramSession(problem, startedAt);

    expect(session.status).toBe("playing");
    expect(formatBoard(session.puzzleState)).toEqual(["...", "...", "..."]);
  });
});

describe("startNonogramSessionStroke", () => {
  describe("1マスだけ押した場合", () => {
    const cases = [
      ["未確定に塗り", "...", "filled", "#..", 0],
      ["未確定に ×", "...", "crossed", "x..", 0],
      ["塗りに塗り", "#..", "filled", "...", 1],
      ["× に ×", "x..", "crossed", "...", 0],
      ["× に塗り", "x..", "filled", "#..", 0],
      ["塗りに ×", "#..", "crossed", "x..", 1],
    ] as const;

    test.each(cases)(
      "%s を入れると、マスと塗り直しの数が変わること",
      (_, firstRow, mark, expectedFirstRow, expectedRepaintCount) => {
        const session = tap(withBoard([firstRow, "...", "..."]), 0, mark);

        expect(formatBoard(session.puzzleState)[0]).toBe(expectedFirstRow);
        expect(getNonogramSessionRepaintCount(session)).toBe(
          expectedRepaintCount,
        );
      },
    );
  });

  describe("盤面の外のマスの場合", () => {
    const session = createNonogramSession(problem, startedAt);

    test("session を変えないこと", () => {
      const next = startNonogramSessionStroke(session, 9, "filled", startedAt);

      expect(next).toBe(session);
    });
  });

  describe("入力中に次の入力を始めた場合", () => {
    const session = drag(
      createNonogramSession(problem, startedAt),
      [0, 1],
      "filled",
    );

    test("前の入力を終えてから新しい入力を始めること", () => {
      const next = startNonogramSessionStroke(session, 8, "filled", startedAt);

      expect(formatBoard(next.puzzleState)).toEqual(["##.", "...", "..#"]);
      expect(next.history).toHaveLength(2);
    });
  });

  describe("塗りが図柄と一致した場合", () => {
    test("× や未確定が残っていてもクリアにし、入力を終えること", () => {
      const session = startNonogramSessionStroke(
        almostSolved,
        7,
        "filled",
        clearedAt,
      );

      expect(session.status).toBe("cleared");
      expect(session.finishedAt).toBe(clearedAt);
      expect(session.stroke).toBeNull();
    });
  });

  describe("クリア済みの場合", () => {
    test("入力を受け付けないこと", () => {
      const next = startNonogramSessionStroke(cleared, 8, "filled", clearedAt);

      expect(next).toBe(cleared);
    });
  });
});

describe("extendNonogramSessionStroke", () => {
  const empty = createNonogramSession(problem, startedAt);

  test("始点から押しているマスまでの行に印を入れること", () => {
    const session = drag(empty, [3, 4, 5], "crossed");

    expect(formatBoard(session.puzzleState)).toEqual(["...", "xxx", "..."]);
  });

  test("飛ばしたマスも含めて始点から終点まで入れること", () => {
    const session = drag(empty, [0, 6], "crossed");

    expect(formatBoard(session.puzzleState)).toEqual(["x..", "x..", "x.."]);
  });

  test("最初に動いた向きで入れる行・列を固定すること", () => {
    const session = drag(empty, [0, 3, 5], "crossed");

    expect(formatBoard(session.puzzleState)).toEqual(["x..", "x..", "..."]);
  });

  describe("斜めに動いた場合", () => {
    test("大きく動いた向きの列に入れること", () => {
      const session = drag(empty, [0, 7], "crossed");

      expect(formatBoard(session.puzzleState)).toEqual(["x..", "x..", "x.."]);
    });
  });

  test("戻って範囲が縮んだマスを押す前の状態に戻すこと", () => {
    const session = drag(empty, [0, 2, 1], "crossed");

    expect(formatBoard(session.puzzleState)).toEqual(["xx.", "...", "..."]);
    expect(getNonogramSessionStrokeRange(session)).toEqual({
      startCellIndex: 0,
      endCellIndex: 1,
    });
  });

  test("印を入れる入力は別の印のマスを上書きしないこと", () => {
    const session = drag(withBoard(["..x", "...", "..."]), [0, 2], "filled");

    expect(formatBoard(session.puzzleState)[0]).toBe("##x");
  });

  test("印を消す入力は同じ印のマスだけを消すこと", () => {
    const session = drag(withBoard(["#x#", "...", "..."]), [0, 2], "filled");

    expect(formatBoard(session.puzzleState)[0]).toBe(".x.");
    expect(getNonogramSessionRepaintCount(session)).toBe(2);
  });

  describe("なぞった塗りで図柄と一致した場合", () => {
    const stroking = startNonogramSessionStroke(
      withBoard(["#.#", "#..", ".#."]),
      4,
      "filled",
      startedAt,
    );

    test("なぞった時刻でクリアにし、入力を終えること", () => {
      const session = extendNonogramSessionStroke(stroking, 5, clearedAt);

      expect(session.status).toBe("cleared");
      expect(session.finishedAt).toBe(clearedAt);
      expect(session.stroke).toBeNull();
    });

    test("その後のなぞりを受け付けないこと", () => {
      const session = extendNonogramSessionStroke(stroking, 5, clearedAt);

      const next = extendNonogramSessionStroke(session, 3, clearedAt);

      expect(next).toBe(session);
    });
  });

  describe("入力中でない場合", () => {
    test("session を変えないこと", () => {
      const next = extendNonogramSessionStroke(empty, 1, startedAt);

      expect(next).toBe(empty);
    });
  });

  describe("クリア済みの場合", () => {
    test("session を変えないこと", () => {
      const next = extendNonogramSessionStroke(cleared, 8, clearedAt);

      expect(next).toBe(cleared);
    });
  });
});

describe("undoNonogramSession", () => {
  describe("1回のドラッグで塗った場合", () => {
    const session = endNonogramSessionStroke(
      drag(createNonogramSession(problem, startedAt), [0, 1, 2], "filled"),
    );

    test("ドラッグ全体を1手として取り消し、消えた塗りを塗り直しに数えること", () => {
      const next = undoNonogramSession(session);

      expect(formatBoard(next.puzzleState)).toEqual(["...", "...", "..."]);
      expect(next.undoCount).toBe(1);
      expect(getNonogramSessionRepaintCount(next)).toBe(3);
      expect(canUndoNonogramSession(next)).toBe(false);
    });
  });

  describe("× を入れた場合", () => {
    const session = tap(
      createNonogramSession(problem, startedAt),
      1,
      "crossed",
    );

    test("取り消しても塗り直しに数えないこと", () => {
      const next = undoNonogramSession(session);

      expect(getNonogramSessionRepaintCount(next)).toBe(0);
    });
  });

  describe("取り消せる入力が無い場合", () => {
    const session = createNonogramSession(problem, startedAt);

    test("session を変えないこと", () => {
      const next = undoNonogramSession(session);

      expect(next).toBe(session);
    });
  });

  describe("クリア済みの場合", () => {
    test("取り消さないこと", () => {
      const next = undoNonogramSession(cleared);

      expect(next).toBe(cleared);
    });
  });
});

describe("restartNonogramSession", () => {
  describe("待ったで塗りを消した後に塗りと × がある場合", () => {
    const undone = undoNonogramSession(
      tap(createNonogramSession(problem, startedAt), 0, "filled"),
    );
    const session = drag(tap(undone, 1, "crossed"), [3, 4, 5], "filled");

    test("全マスを未確定に戻し、待ったで戻せなくすること", () => {
      const next = restartNonogramSession(session);

      expect(formatBoard(next.puzzleState)).toEqual(["...", "...", "..."]);
      expect(next.restartCount).toBe(1);
      expect(canUndoNonogramSession(next)).toBe(false);
    });

    test("それまでの塗り直しに、消えた塗りのマスを足すこと", () => {
      const next = restartNonogramSession(session);

      expect(getNonogramSessionRepaintCount(next)).toBe(1 + 3);
    });
  });

  describe("全マスが未確定の場合", () => {
    const session = createNonogramSession(problem, startedAt);

    test("盤面を戻せず、回数も数えないこと", () => {
      const next = restartNonogramSession(session);

      expect(canRestartNonogramSession(session)).toBe(false);
      expect(next).toBe(session);
    });
  });

  describe("クリア済みの場合", () => {
    test("盤面を戻さないこと", () => {
      const next = restartNonogramSession(cleared);

      expect(next).toBe(cleared);
    });
  });
});

describe("getNonogramSessionResult", () => {
  describe("クリア済みの場合", () => {
    test("クリアまでのプレイ事実を返すこと", () => {
      const result = getNonogramSessionResult(cleared);

      expect(result).toEqual({
        elapsedMs: clearedAt - startedAt,
        repaintCount: 0,
        undoCount: 0,
        restartCount: 0,
        inputCount: 1,
      });
    });
  });

  describe("プレイ中の場合", () => {
    test("結果を返さないこと", () => {
      const result = getNonogramSessionResult(almostSolved);

      expect(result).toBeNull();
    });
  });
});
