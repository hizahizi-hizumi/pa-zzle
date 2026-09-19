// @vitest-environment node

import { describe, expect, test } from "vitest";

import { generateWaterSortProblem } from "../problem/generator";
import { solveWaterSort } from "../puzzle/solver";
import {
  applyWaterSortSessionMove,
  canUndoWaterSortSession,
  createWaterSortSession,
  getWaterSortSessionResult,
  restartWaterSortSession,
  undoWaterSortSession,
} from "./session";

function createProblem() {
  return generateWaterSortProblem({
    seed: "water-sort-session-test",
    colorCount: 3,
  });
}

function getSolutionMoves(problem: {
  initialState: Parameters<typeof solveWaterSort>[0];
}) {
  const result = solveWaterSort(problem.initialState);
  if (result.status !== "solved") {
    throw new Error("test problem must be solvable");
  }
  return result.moves;
}

describe("applyWaterSortSessionMove", () => {
  test("合法手を適用して盤面と手数を進めること", () => {
    const problem = createProblem();
    const session = createWaterSortSession(
      { initialState: problem.initialState },
      1000,
    );
    const solutionMoves = getSolutionMoves(problem);
    const move = solutionMoves[0];
    if (!move) {
      throw new Error("test problem must have a solution move");
    }

    const result = applyWaterSortSessionMove(session, move, 1100);

    expect(result).not.toBeNull();
    expect(result?.state).not.toEqual(problem.initialState);
    expect(result?.moveCount).toBe(1);
    expect(session.state).toEqual(problem.initialState);
  });

  test("成立しない手ではセッションを変更しないこと", () => {
    const problem = createProblem();
    const session = createWaterSortSession(
      { initialState: problem.initialState },
      1000,
    );

    const result = applyWaterSortSessionMove(
      session,
      { sourceBottleIndex: 0, destinationBottleIndex: 0 },
      1100,
    );

    expect(result).toBeNull();
    expect(session.state).toEqual(problem.initialState);
  });
});

describe("undoWaterSortSession", () => {
  test("盤面を一手戻しても成立済みの注水手数を減らさないこと", () => {
    const problem = createProblem();
    const initialSession = createWaterSortSession(
      { initialState: problem.initialState },
      1000,
    );
    const solutionMoves = getSolutionMoves(problem);
    const move = solutionMoves[0];
    if (!move) {
      throw new Error("test problem must have a solution move");
    }
    const moved = applyWaterSortSessionMove(initialSession, move, 1100);
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
    const problem = createProblem();
    const session = createWaterSortSession(
      { initialState: problem.initialState },
      1000,
    );

    const result = undoWaterSortSession(session);

    expect(result).toBe(session);
    expect(result.undoCount).toBe(0);
  });
});

describe("restartWaterSortSession", () => {
  test("プレイ中は同じ計測を継続して初期盤面へ戻すこと", () => {
    const problem = createProblem();
    const initialSession = createWaterSortSession(
      { initialState: problem.initialState },
      1000,
    );
    const solutionMoves = getSolutionMoves(problem);
    const move = solutionMoves[0];
    if (!move) {
      throw new Error("test problem must have a solution move");
    }
    const moved = applyWaterSortSessionMove(initialSession, move, 1100);
    if (!moved) {
      throw new Error("test solution move must be legal");
    }

    const result = restartWaterSortSession(moved);

    expect(result.state).toEqual(problem.initialState);
    expect(result.startedAt).toBe(1000);
    expect(result.moveCount).toBe(1);
    expect(result.restartCount).toBe(1);
    expect(canUndoWaterSortSession(result)).toBe(false);
  });

  test("クリア済みのセッションはやり直さないこと", () => {
    const problem = createProblem();
    let session = createWaterSortSession(
      { initialState: problem.initialState },
      1000,
    );
    const solutionMoves = getSolutionMoves(problem);
    for (const [index, move] of solutionMoves.entries()) {
      const next = applyWaterSortSessionMove(session, move, 1100 + index);
      if (!next) {
        throw new Error("test solution move must be legal");
      }
      session = next;
    }

    const result = restartWaterSortSession(session);

    expect(result).toBe(session);
  });
});

test("Reactなしで操作・待った・やり直しを経て一局を完結できること", () => {
  const problem = createProblem();
  let session = createWaterSortSession(
    { initialState: problem.initialState },
    1000,
  );
  const solutionMoves = getSolutionMoves(problem);
  const firstMove = solutionMoves[0];
  if (!firstMove) {
    throw new Error("test problem must have a solution move");
  }

  const firstMoved = applyWaterSortSessionMove(session, firstMove, 1100);
  if (!firstMoved) {
    throw new Error("test solution move must be legal");
  }
  session = undoWaterSortSession(firstMoved);
  session = restartWaterSortSession(session);
  for (const [index, move] of solutionMoves.entries()) {
    const next = applyWaterSortSessionMove(session, move, 1300 + index);
    if (!next) {
      throw new Error("test solution move must be legal");
    }
    session = next;
  }
  const result = getWaterSortSessionResult(session, 9999);

  expect(session.status).toBe("cleared");
  expect(result).toEqual({
    elapsedMs: expect.any(Number),
    moveCount: solutionMoves.length + 1,
    completionMoveCount: solutionMoves.length,
    undoCount: 1,
    restartCount: 1,
  });
});
