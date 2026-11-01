import { parseHamiltonianPathBoard } from "@/games/hamiltonian-path/puzzle/board";
import {
  canRestartHamiltonianPathSession,
  canUndoHamiltonianPathSession,
  createHamiltonianPathSession,
  extendHamiltonianPathSessionPath,
  getHamiltonianPathSessionResult,
  type HamiltonianPathSession,
  moveHamiltonianPathSessionHead,
  restartHamiltonianPathSession,
  rewindHamiltonianPathSessionPath,
  undoHamiltonianPathSession,
} from "@/games/hamiltonian-path/session/session";

/**
 * 左上が始点、右下が壁、中央とその下の間に仕切りがある 3×3 の盤面。
 * 0 1 2
 * 3 4 5
 * 6 7 #
 */
const problem = parseHamiltonianPathBoard([
  "S . .",
  "",
  ". . .",
  "  -",
  ". . #",
]);
const solution = [0, 1, 2, 5, 4, 3, 6, 7];
const startedAt = 1_000;
const clearedAt = 61_000;

function extendAll(
  session: HamiltonianPathSession,
  cells: readonly number[],
  operatedAt = startedAt,
): HamiltonianPathSession {
  return cells.reduce(
    (current, cell) =>
      extendHamiltonianPathSessionPath(current, cell, operatedAt).session,
    session,
  );
}

const initial = createHamiltonianPathSession(problem, startedAt);
const halfway = extendAll(initial, [1, 2, 5, 4]);
const cleared = extendAll(halfway, [3, 6, 7], clearedAt);

describe("createHamiltonianPathSession", () => {
  test("道が始点だけのプレイを始めること", () => {
    const session = createHamiltonianPathSession(problem, startedAt);

    expect(session.status).toBe("playing");
    expect(session.puzzleState.path).toEqual([problem.start]);
    expect(session.startedAt).toBe(startedAt);
    expect(canUndoHamiltonianPathSession(session)).toBe(false);
    expect(canRestartHamiltonianPathSession(session)).toBe(false);
  });

  describe("有効マスがつながっていない問題の場合", () => {
    const disconnected = parseHamiltonianPathBoard(["S #", "", "# ."]);

    test("問題を受け付けないこと", () => {
      const act = () => createHamiltonianPathSession(disconnected, startedAt);

      expect(act).toThrow();
    });
  });
});

describe("extendHamiltonianPathSessionPath", () => {
  test("先端に隣り合う未通過マスへ道を延ばすこと", () => {
    const { session, rejection } = extendHamiltonianPathSessionPath(
      initial,
      1,
      startedAt,
    );

    expect(rejection).toBeNull();
    expect(session.puzzleState.path).toEqual([0, 1]);
    expect(canUndoHamiltonianPathSession(session)).toBe(true);
  });

  const rejectedCases = [
    ["先端から離れたマス", initial, 2, "not-adjacent"],
    ["先端そのもの", initial, 0, "not-adjacent"],
    ["壁マス", extendAll(initial, [1, 2, 5]), 8, "wall"],
    ["仕切りの向こうのマス", halfway, 7, "partition"],
    ["通過済みのマス", halfway, 1, "visited"],
  ] as const;

  test.each(rejectedCases)(
    "%sへは延ばさず理由を返すこと",
    (_, session, cell, reason) => {
      const result = extendHamiltonianPathSessionPath(session, cell, startedAt);

      expect(result.rejection).toBe(reason);
      expect(result.session).toBe(session);
    },
  );

  describe("全有効マスを通った場合", () => {
    test("その時刻でクリアにすること", () => {
      const session = extendAll(initial, solution.slice(1), clearedAt);

      expect(session.puzzleState.path).toEqual(solution);
      expect(session.status).toBe("cleared");
      expect(session.finishedAt).toBe(clearedAt);
    });
  });

  describe("クリアした後の場合", () => {
    test("操作を受け付けず理由も返さないこと", () => {
      const result = extendHamiltonianPathSessionPath(cleared, 0, clearedAt);

      expect(result.session).toBe(cleared);
      expect(result.rejection).toBeNull();
    });
  });
});

describe("moveHamiltonianPathSessionHead", () => {
  test("直前のマスへ動かすと道を1マス縮めること", () => {
    const { session, rejection } = moveHamiltonianPathSessionHead(
      halfway,
      5,
      startedAt,
    );

    expect(rejection).toBeNull();
    expect(session.puzzleState.path).toEqual([0, 1, 2, 5]);
  });

  test("隣の未通過マスへ動かすと道を延ばすこと", () => {
    const { session } = moveHamiltonianPathSessionHead(halfway, 3, startedAt);

    expect(session.puzzleState.path).toEqual([0, 1, 2, 5, 4, 3]);
  });

  test("直前より前の通過済みのマスへは動かさないこと", () => {
    const result = moveHamiltonianPathSessionHead(halfway, 1, startedAt);

    expect(result.rejection).toBe("visited");
    expect(result.session).toBe(halfway);
  });
});

describe("rewindHamiltonianPathSessionPath", () => {
  test("道の途中のマスまで巻き戻すこと", () => {
    const session = rewindHamiltonianPathSessionPath(halfway, 2);

    expect(session.puzzleState.path).toEqual([0, 1, 2]);
  });

  test("始点を選ぶと道を始点だけにすること", () => {
    const session = rewindHamiltonianPathSessionPath(halfway, 0);

    expect(session.puzzleState.path).toEqual([0]);
  });

  test.each([
    ["先端", 4],
    ["道に無いマス", 3],
  ])("%sを選んでも何も変えないこと", (_, cell) => {
    const session = rewindHamiltonianPathSessionPath(halfway, cell);

    expect(session).toBe(halfway);
  });
});

describe("undoHamiltonianPathSession", () => {
  test("直前の1操作だけを取り消して待った回数を数えること", () => {
    const session = undoHamiltonianPathSession(halfway);

    expect(session.puzzleState.path).toEqual([0, 1, 2, 5]);
    expect(session.undoCount).toBe(1);
  });

  describe("巻き戻した後の場合", () => {
    const rewound = rewindHamiltonianPathSessionPath(halfway, 0);

    test("巻き戻す前の道へ戻すこと", () => {
      const session = undoHamiltonianPathSession(rewound);

      expect(session.puzzleState.path).toEqual(halfway.puzzleState.path);
    });
  });

  describe("盤面を戻した後の場合", () => {
    const restarted = restartHamiltonianPathSession(halfway);

    test("盤面を戻す前の操作は取り消せないこと", () => {
      const session = undoHamiltonianPathSession(restarted);

      expect(session).toBe(restarted);
      expect(canUndoHamiltonianPathSession(restarted)).toBe(false);
    });
  });

  describe("クリアした後の場合", () => {
    test("取り消せないこと", () => {
      const session = undoHamiltonianPathSession(cleared);

      expect(session).toBe(cleared);
      expect(canUndoHamiltonianPathSession(cleared)).toBe(false);
    });
  });
});

describe("restartHamiltonianPathSession", () => {
  test("道を始点だけに戻して盤面を戻した回数を数えること", () => {
    const session = restartHamiltonianPathSession(halfway);

    expect(session.puzzleState.path).toEqual([problem.start]);
    expect(session.restartCount).toBe(1);
    expect(session.startedAt).toBe(halfway.startedAt);
  });

  describe("道が始点だけの場合", () => {
    test("何も変えず回数も数えないこと", () => {
      const session = restartHamiltonianPathSession(initial);

      expect(session).toBe(initial);
    });
  });

  describe("クリアした後の場合", () => {
    test("何も変えないこと", () => {
      const session = restartHamiltonianPathSession(cleared);

      expect(session).toBe(cleared);
      expect(canRestartHamiltonianPathSession(cleared)).toBe(false);
    });
  });
});

describe("getHamiltonianPathSessionResult", () => {
  test("プレイ中は結果を返さないこと", () => {
    const result = getHamiltonianPathSessionResult(halfway);

    expect(result).toBeNull();
  });

  describe("待ったと盤面を戻すを経てクリアした場合", () => {
    const session = extendAll(
      restartHamiltonianPathSession(
        undoHamiltonianPathSession(extendAll(initial, [1, 4])),
      ),
      solution.slice(1),
      clearedAt,
    );

    test("経過時間・待った・盤面を戻した回数を返すこと", () => {
      const result = getHamiltonianPathSessionResult(session);

      expect(result).toEqual({
        elapsedMs: clearedAt - startedAt,
        undoCount: 1,
        restartCount: 1,
      });
    });
  });
});
