// @vitest-environment node

import type { WaterSortProblem } from "../problem/problem";
import type { WaterSortMove } from "../puzzle/state";
import {
  applyWaterSortSessionMove,
  canUndoWaterSortSession,
  createWaterSortSession,
  getWaterSortSessionResult,
  restartWaterSortSession,
  undoWaterSortSession,
  type WaterSortSession,
} from "./session";

const problem: WaterSortProblem = {
  initialState: [[0, 0, 0, 1], [1, 1, 1, 0], [], []],
};

const solutionMoves: readonly WaterSortMove[] = [
  { sourceBottleIndex: 0, destinationBottleIndex: 2 },
  { sourceBottleIndex: 1, destinationBottleIndex: 0 },
  { sourceBottleIndex: 2, destinationBottleIndex: 1 },
];

function requireFirstSolutionMove(): WaterSortMove {
  const move = solutionMoves[0];
  if (!move) {
    throw new Error("test problem must have a solution move");
  }
  return move;
}

function requireAppliedMove(
  session: WaterSortSession,
  move: WaterSortMove,
  now: number,
): WaterSortSession {
  const next = applyWaterSortSessionMove(session, move, now);
  if (!next) {
    throw new Error("test solution move must be legal");
  }
  return next;
}

function applySolution(session: WaterSortSession) {
  let current = session;
  for (const [index, move] of solutionMoves.entries()) {
    current = requireAppliedMove(current, move, 1_100 + index);
  }
  return current;
}

describe("applyWaterSortSessionMove", () => {
  describe("合法手を適用する場合", () => {
    let session: WaterSortSession;
    let move: WaterSortMove;

    beforeEach(() => {
      session = createWaterSortSession(problem, 1_000);
      move = requireFirstSolutionMove();
    });

    test("盤面と手数を進めること", () => {
      const result = applyWaterSortSessionMove(session, move, 1_100);

      expect(result).not.toBeNull();
      expect(result?.state).not.toEqual(problem.initialState);
      expect(result?.moveCount).toBe(1);
      expect(session.state).toEqual(problem.initialState);
    });
  });

  describe("成立しない手を適用する場合", () => {
    const illegalMove = {
      sourceBottleIndex: 0,
      destinationBottleIndex: 0,
    } as const;
    let session: WaterSortSession;

    beforeEach(() => {
      session = createWaterSortSession(problem, 1_000);
    });

    test("セッションを変更しないこと", () => {
      const result = applyWaterSortSessionMove(session, illegalMove, 1_100);

      expect(result).toBeNull();
      expect(session.state).toEqual(problem.initialState);
    });
  });
});

describe("undoWaterSortSession", () => {
  describe("成立済みの注水履歴がある場合", () => {
    let moved: WaterSortSession;

    beforeEach(() => {
      const initialSession = createWaterSortSession(problem, 1_000);
      moved = requireAppliedMove(
        initialSession,
        requireFirstSolutionMove(),
        1_100,
      );
    });

    test("盤面を一手戻しても成立済みの注水手数を減らさないこと", () => {
      const result = undoWaterSortSession(moved);
      const canUndo = canUndoWaterSortSession(result);

      expect(result.state).toEqual(problem.initialState);
      expect(result.moveCount).toBe(1);
      expect(result.undoCount).toBe(1);
      expect(canUndo).toBe(false);
    });
  });

  describe("戻せる履歴がない場合", () => {
    let session: WaterSortSession;

    beforeEach(() => {
      session = createWaterSortSession(problem, 1_000);
    });

    test("回数を変更しないこと", () => {
      const result = undoWaterSortSession(session);

      expect(result).toBe(session);
      expect(result.undoCount).toBe(0);
    });
  });
});

describe("restartWaterSortSession", () => {
  describe("プレイ中に注水履歴がある場合", () => {
    let moved: WaterSortSession;

    beforeEach(() => {
      const initialSession = createWaterSortSession(problem, 1_000);
      moved = requireAppliedMove(
        initialSession,
        requireFirstSolutionMove(),
        1_100,
      );
    });

    test("同じ計測を継続して初期盤面へ戻すこと", () => {
      const result = restartWaterSortSession(moved);
      const canUndo = canUndoWaterSortSession(result);

      expect(result.state).toEqual(problem.initialState);
      expect(result.startedAt).toBe(1_000);
      expect(result.moveCount).toBe(1);
      expect(result.restartCount).toBe(1);
      expect(canUndo).toBe(false);
    });
  });

  describe("クリア済みの場合", () => {
    let session: WaterSortSession;

    beforeEach(() => {
      session = applySolution(createWaterSortSession(problem, 1_000));
    });

    test("やり直さないこと", () => {
      const result = restartWaterSortSession(session);

      expect(result).toBe(session);
    });
  });
});

describe("一局のプレイ", () => {
  let session: WaterSortSession;
  let firstMove: WaterSortMove;

  beforeEach(() => {
    session = createWaterSortSession(problem, 1_000);
    firstMove = requireFirstSolutionMove();
  });

  test("Reactなしで操作・待った・やり直しを経て完結できること", () => {
    const firstMoved = requireAppliedMove(session, firstMove, 1_100);
    session = undoWaterSortSession(firstMoved);
    session = restartWaterSortSession(session);
    session = applySolution(session);
    const result = getWaterSortSessionResult(session, 9_999);

    expect(session.status).toBe("cleared");
    expect(result).toEqual({
      elapsedMs: expect.any(Number),
      moveCount: solutionMoves.length + 1,
      completionMoveCount: solutionMoves.length,
      undoCount: 1,
      restartCount: 1,
    });
  });
});
