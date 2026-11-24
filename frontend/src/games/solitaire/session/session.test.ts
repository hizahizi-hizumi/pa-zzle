import type { SolitaireProblem } from "@/games/solitaire/problem/problem";
import type { SolitaireMove } from "@/games/solitaire/puzzle/rules";
import type { SolitaireState } from "@/games/solitaire/puzzle/state";
import {
  applySolitaireSessionMove,
  canRestartSolitaireSession,
  canUndoSolitaireSession,
  createSolitaireSession,
  getSolitaireSessionResult,
  restartSolitaireSession,
  type SolitaireSession,
  undoSolitaireSession,
} from "@/games/solitaire/session/session";

// 調査コード solitaire_difficulty.py の deal(3)。列1の ♥A は、最初から組札へ送れる。
const problem: SolitaireProblem = {
  columns: [
    [13],
    [28, 3],
    [19, 29, 26],
    [51, 22, 36, 10],
    [32, 6, 11, 17, 33],
    [48, 24, 31, 1, 18, 5],
    [2, 21, 44, 47, 43, 41, 27],
  ],
  stock: [
    42, 20, 7, 9, 25, 49, 39, 12, 14, 35, 16, 45, 0, 46, 4, 50, 40, 30, 38, 23,
    8, 34, 37, 15,
  ],
};
const startedAt = 1_000;
const draw: SolitaireMove = { kind: "draw" };
const heartAceToFoundation: SolitaireMove = {
  kind: "transfer",
  source: { pile: "column", columnIndex: 0 },
  destination: { pile: "foundation" },
  cardCount: 1,
};

describe("createSolitaireSession", () => {
  test("配った直後の盤面で、山札を裏向きのまま捨て札を空にして始めること", () => {
    const session = createSolitaireSession(problem, startedAt);

    expect(session).toMatchObject({
      status: "playing",
      puzzleState: {
        columns: problem.columns,
        stock: problem.stock,
        waste: [],
        foundations: { spades: 0, hearts: 0, diamonds: 0, clubs: 0 },
      },
      history: [],
      startedAt,
      clearedAt: null,
      moveCount: 0,
      undoCount: 0,
      restartCount: 0,
    });
  });
});

describe("applySolitaireSessionMove", () => {
  const session = createSolitaireSession(problem, startedAt);

  test("打った手を1手と数え、打つ前の盤面を待ったで戻れるように残すこと", () => {
    const next = applySolitaireSessionMove(
      session,
      heartAceToFoundation,
      2_000,
    );

    expect(next).toMatchObject({
      moveCount: 1,
      history: [session.puzzleState],
      puzzleState: { foundations: { hearts: 1 } },
    });
  });

  test("山札をめくる手も1手と数えること", () => {
    const next = applySolitaireSessionMove(session, draw, 2_000);

    expect(next).toMatchObject({ moveCount: 1, puzzleState: { waste: [42] } });
  });

  describe("打てない手", () => {
    const illegalMove: SolitaireMove = {
      kind: "transfer",
      source: { pile: "column", columnIndex: 1 },
      destination: { pile: "foundation" },
      cardCount: 1,
    };

    test("session を変えないこと", () => {
      const next = applySolitaireSessionMove(session, illegalMove, 2_000);

      expect(next).toBe(session);
    });
  });

  describe("最後の1枚を組札へ送る手", () => {
    const lastCardState: SolitaireState = {
      columns: [[], [], [], [], [], [], [51]],
      stock: [],
      waste: [],
      foundations: { spades: 13, hearts: 13, diamonds: 13, clubs: 12 },
    };
    const nearlyCleared: SolitaireSession = {
      ...session,
      puzzleState: lastCardState,
    };
    const lastMove: SolitaireMove = {
      kind: "transfer",
      source: { pile: "column", columnIndex: 6 },
      destination: { pile: "foundation" },
      cardCount: 1,
    };

    test("クリアにして、クリアした時刻を残すこと", () => {
      const cleared = applySolitaireSessionMove(nearlyCleared, lastMove, 9_000);

      expect(cleared).toMatchObject({ status: "cleared", clearedAt: 9_000 });
    });
  });

  describe("クリアした後", () => {
    const cleared: SolitaireSession = {
      ...session,
      status: "cleared",
      clearedAt: 9_000,
    };

    test("手を受け付けないこと", () => {
      const next = applySolitaireSessionMove(cleared, draw, 10_000);

      expect(next).toBe(cleared);
    });
  });
});

describe("undoSolitaireSession", () => {
  const initial = createSolitaireSession(problem, startedAt);
  const moved = applySolitaireSessionMove(
    applySolitaireSessionMove(initial, draw, 2_000),
    heartAceToFoundation,
    3_000,
  );

  test("直前の盤面へ戻し、待ったの回数を数え、打った手の数は変えないこと", () => {
    const undone = undoSolitaireSession(moved);

    expect(undone).toMatchObject({
      puzzleState: moved.history[1],
      history: [initial.puzzleState],
      moveCount: 2,
      undoCount: 1,
    });
  });

  describe("配った直後", () => {
    test("待ったできず、session を変えないこと", () => {
      const result = {
        canUndo: canUndoSolitaireSession(initial),
        undone: undoSolitaireSession(initial),
      };

      expect(result).toEqual({ canUndo: false, undone: initial });
    });
  });
});

describe("restartSolitaireSession", () => {
  const initial = createSolitaireSession(problem, startedAt);
  const moved = applySolitaireSessionMove(
    applySolitaireSessionMove(initial, draw, 2_000),
    heartAceToFoundation,
    3_000,
  );

  test("配った直後の盤面へ戻し、盤面を戻した回数を数え、経過時間と手数は引き継ぐこと", () => {
    const restarted = restartSolitaireSession(moved);

    expect(restarted).toMatchObject({
      puzzleState: initial.puzzleState,
      history: [],
      startedAt,
      moveCount: 2,
      restartCount: 1,
    });
  });

  describe("配った直後の盤面", () => {
    test("盤面を戻せず、回数も数えないこと", () => {
      const result = {
        canRestart: canRestartSolitaireSession(initial),
        restarted: restartSolitaireSession(initial),
      };

      expect(result).toEqual({ canRestart: false, restarted: initial });
    });
  });

  describe("待ったで配った直後へ戻った盤面", () => {
    const undone = undoSolitaireSession(
      applySolitaireSessionMove(initial, draw, 2_000),
    );

    test("盤面を戻せないこと", () => {
      const canRestart = canRestartSolitaireSession(undone);

      expect(canRestart).toBe(false);
    });
  });
});

describe("getSolitaireSessionResult", () => {
  const playing = createSolitaireSession(problem, startedAt);
  const cleared: SolitaireSession = {
    ...playing,
    status: "cleared",
    clearedAt: 61_000,
    moveCount: 130,
    undoCount: 3,
    restartCount: 1,
  };

  test("クリアしたプレイの経過時間と回数を返すこと", () => {
    const result = getSolitaireSessionResult(cleared);

    expect(result).toEqual({
      elapsedMs: 60_000,
      moveCount: 130,
      undoCount: 3,
      restartCount: 1,
    });
  });

  test("クリアしていないプレイは null を返すこと", () => {
    const result = getSolitaireSessionResult(playing);

    expect(result).toBeNull();
  });
});
