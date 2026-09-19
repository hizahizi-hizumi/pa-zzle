// @vitest-environment node

import { describe, expect, test } from "vitest";

import type { WaterSortProblem } from "../problem/problem";
import type { WaterSortMove } from "../puzzle/state";
import {
  applyWaterSortSessionMove,
  canUndoWaterSortSession,
  createWaterSortSession,
  getWaterSortSessionResult,
  restartWaterSortSession,
  undoWaterSortSession,
} from "./session";

const problem: WaterSortProblem = {
  initialState: [[0, 0, 0, 1], [1, 1, 1, 0], [], []],
};

const solutionMoves: readonly WaterSortMove[] = [
  { sourceBottleIndex: 0, destinationBottleIndex: 2 },
  { sourceBottleIndex: 1, destinationBottleIndex: 0 },
  { sourceBottleIndex: 2, destinationBottleIndex: 1 },
];

function applySolution(session: ReturnType<typeof createWaterSortSession>) {
  let current = session;
  for (const [index, move] of solutionMoves.entries()) {
    const next = applyWaterSortSessionMove(current, move, 1_100 + index);
    if (!next) {
      throw new Error("test solution move must be legal");
    }
    current = next;
  }
  return current;
}

describe("applyWaterSortSessionMove", () => {
  test("合法手を適用して盤面と手数を進めること", () => {
    const session = createWaterSortSession(problem, 1_000);
    const move = solutionMoves[0];
    if (!move) {
      throw new Error("test problem must have a solution move");
    }

    const result = applyWaterSortSessionMove(session, move, 1_100);

    expect(result).not.toBeNull();
    expect(result?.state).not.toEqual(problem.initialState);
    expect(result?.moveCount).toBe(1);
    expect(session.state).toEqual(problem.initialState);
  });

  test("成立しない手ではセッションを変更しないこと", () => {
    const session = createWaterSortSession(problem, 1_000);

    const result = applyWaterSortSessionMove(
      session,
      { sourceBottleIndex: 0, destinationBottleIndex: 0 },
      1_100,
    );

    expect(result).toBeNull();
    expect(session.state).toEqual(problem.initialState);
  });
});

describe("undoWaterSortSession", () => {
  test("盤面を一手戻しても成立済みの注水手数を減らさないこと", () => {
    const initialSession = createWaterSortSession(problem, 1_000);
    const move = solutionMoves[0];
    if (!move) {
      throw new Error("test problem must have a solution move");
    }
    const moved = applyWaterSortSessionMove(initialSession, move, 1_100);
    if (!moved) {
      throw new Error("test solution move must be legal");
    }

    const result = undoWaterSortSession(moved);

    expect(result.state).toEqual(problem.initialState);
    expect(result.moveCount).toBe(1);
    expect(result.undoCount).toBe(1);
    expect(canUndoWaterSortSession(result)).toBe(false);
  });

  test("戻せる履歴がなければ回数を変更しないこと", () => {
    const session = createWaterSortSession(problem, 1_000);

    const result = undoWaterSortSession(session);

    expect(result).toBe(session);
    expect(result.undoCount).toBe(0);
  });
});

describe("restartWaterSortSession", () => {
  test("プレイ中は同じ計測を継続して初期盤面へ戻すこと", () => {
    const initialSession = createWaterSortSession(problem, 1_000);
    const move = solutionMoves[0];
    if (!move) {
      throw new Error("test problem must have a solution move");
    }
    const moved = applyWaterSortSessionMove(initialSession, move, 1_100);
    if (!moved) {
      throw new Error("test solution move must be legal");
    }

    const result = restartWaterSortSession(moved);

    expect(result.state).toEqual(problem.initialState);
    expect(result.startedAt).toBe(1_000);
    expect(result.moveCount).toBe(1);
    expect(result.restartCount).toBe(1);
    expect(canUndoWaterSortSession(result)).toBe(false);
  });

  test("クリア済みのセッションはやり直さないこと", () => {
    const session = applySolution(createWaterSortSession(problem, 1_000));

    const result = restartWaterSortSession(session);

    expect(result).toBe(session);
  });
});

test("Reactなしで操作・待った・やり直しを経て一局を完結できること", () => {
  let session = createWaterSortSession(problem, 1_000);
  const firstMove = solutionMoves[0];
  if (!firstMove) {
    throw new Error("test problem must have a solution move");
  }

  const firstMoved = applyWaterSortSessionMove(session, firstMove, 1_100);
  if (!firstMoved) {
    throw new Error("test solution move must be legal");
  }
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
