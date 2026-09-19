import type { WaterSortProblem } from "../problem/problem";
import { applyWaterSortMove, listWaterSortLegalMoves } from "../puzzle/rules";
import {
  isWaterSortCleared,
  type WaterSortMove,
  type WaterSortState,
} from "../puzzle/state";

export type WaterSortSessionStatus = "playing" | "cleared";

export type WaterSortSession = {
  status: WaterSortSessionStatus;
  problem: WaterSortProblem;
  state: WaterSortState;
  history: readonly WaterSortState[];
  startedAt: number;
  finishedAt: number | null;
  moveCount: number;
  undoCount: number;
  restartCount: number;
};

export type WaterSortSessionResult = {
  elapsedMs: number;
  moveCount: number;
  undoCount: number;
  restartCount: number;
};

export function createWaterSortSession(
  problem: WaterSortProblem,
  startedAt: number,
): WaterSortSession {
  return {
    status: "playing",
    problem,
    state: problem.initialState,
    history: [],
    startedAt,
    finishedAt: null,
    moveCount: 0,
    undoCount: 0,
    restartCount: 0,
  };
}

export function listWaterSortSessionLegalMoves(
  session: WaterSortSession,
): WaterSortMove[] {
  return session.status === "playing"
    ? listWaterSortLegalMoves(session.state)
    : [];
}

export function applyWaterSortSessionMove(
  session: WaterSortSession,
  move: WaterSortMove,
  movedAt: number,
): WaterSortSession | null {
  if (session.status !== "playing") {
    return null;
  }

  const nextState = applyWaterSortMove(session.state, move);
  if (!nextState) {
    return null;
  }

  const cleared = isWaterSortCleared(nextState);
  return {
    ...session,
    status: cleared ? "cleared" : "playing",
    state: nextState,
    history: [...session.history, session.state],
    finishedAt: cleared ? movedAt : null,
    moveCount: session.moveCount + 1,
  };
}

export function undoWaterSortSession(
  session: WaterSortSession,
): WaterSortSession {
  if (session.status !== "playing") {
    return session;
  }

  const previousState = session.history.at(-1);
  if (!previousState) {
    return session;
  }

  return {
    ...session,
    state: previousState,
    history: session.history.slice(0, -1),
    undoCount: session.undoCount + 1,
  };
}

export function restartWaterSortSession(
  session: WaterSortSession,
): WaterSortSession {
  if (session.status !== "playing") {
    return session;
  }

  return {
    ...session,
    state: session.problem.initialState,
    history: [],
    restartCount: session.restartCount + 1,
  };
}

export function canUndoWaterSortSession(session: WaterSortSession): boolean {
  return session.status === "playing" && session.history.length > 0;
}

export function getWaterSortSessionElapsedMs(
  session: WaterSortSession,
  now: number,
): number {
  return Math.max(0, (session.finishedAt ?? now) - session.startedAt);
}

export function getWaterSortSessionResult(
  session: WaterSortSession,
  now: number,
): WaterSortSessionResult | null {
  if (session.status !== "cleared") {
    return null;
  }

  return {
    elapsedMs: getWaterSortSessionElapsedMs(session, now),
    moveCount: session.moveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  };
}
