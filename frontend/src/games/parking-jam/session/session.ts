import type { ParkingJamProblem } from "../problem/problem";
import {
  createParkingJamInitialState,
  isParkingJamCleared,
  type ParkingJamMove,
  type ParkingJamState,
} from "../puzzle/board";
import {
  applyParkingJamMove,
  listParkingJamMoveBlockers,
  type ParkingJamMoveBlocker,
} from "../puzzle/rules";

export type ParkingJamSessionStatus = "playing" | "cleared";

export type ParkingJamSession = {
  status: ParkingJamSessionStatus;
  problem: ParkingJamProblem;
  state: ParkingJamState;
  history: readonly ParkingJamState[];
  startedAt: number;
  finishedAt: number | null;
  moveAttemptCount: number;
  successfulMoveCount: number;
  failedMoveCount: number;
  undoCount: number;
  restartCount: number;
};

export type ParkingJamSessionMoveAttempt =
  | {
      outcome: "exited";
      move: ParkingJamMove;
      session: ParkingJamSession;
    }
  | {
      outcome: "blocked";
      move: ParkingJamMove;
      blockers: readonly ParkingJamMoveBlocker[];
      session: ParkingJamSession;
    };

export type ParkingJamSessionResult = {
  elapsedMs: number;
  moveAttemptCount: number;
  successfulMoveCount: number;
  failedMoveCount: number;
  undoCount: number;
  restartCount: number;
};

export function createParkingJamSession(
  problem: ParkingJamProblem,
  startedAt: number,
): ParkingJamSession {
  return {
    status: "playing",
    problem,
    state: createParkingJamInitialState(problem.board),
    history: [],
    startedAt,
    finishedAt: null,
    moveAttemptCount: 0,
    successfulMoveCount: 0,
    failedMoveCount: 0,
    undoCount: 0,
    restartCount: 0,
  };
}

export function attemptParkingJamSessionMove(
  session: ParkingJamSession,
  move: ParkingJamMove,
  attemptedAt: number,
): ParkingJamSessionMoveAttempt | null {
  if (session.status !== "playing") return null;

  const blockers = listParkingJamMoveBlockers(
    session.problem.board,
    session.state,
    move,
  );
  if (blockers.length > 0) {
    return {
      outcome: "blocked",
      move,
      blockers,
      session: {
        ...session,
        moveAttemptCount: session.moveAttemptCount + 1,
        failedMoveCount: session.failedMoveCount + 1,
      },
    };
  }

  const state = applyParkingJamMove(session.problem.board, session.state, move);
  if (!state) return null;

  const cleared = isParkingJamCleared(state);
  return {
    outcome: "exited",
    move,
    session: {
      ...session,
      status: cleared ? "cleared" : "playing",
      state,
      history: [...session.history, session.state],
      finishedAt: cleared ? attemptedAt : null,
      moveAttemptCount: session.moveAttemptCount + 1,
      successfulMoveCount: session.successfulMoveCount + 1,
    },
  };
}

export function undoParkingJamSession(
  session: ParkingJamSession,
): ParkingJamSession {
  if (session.status !== "playing") return session;

  const previousState = session.history.at(-1);
  if (!previousState) return session;

  return {
    ...session,
    state: previousState,
    history: session.history.slice(0, -1),
    undoCount: session.undoCount + 1,
  };
}

export function restartParkingJamSession(
  session: ParkingJamSession,
): ParkingJamSession {
  if (!canRestartParkingJamSession(session)) return session;

  return {
    ...session,
    state: createParkingJamInitialState(session.problem.board),
    history: [],
    restartCount: session.restartCount + 1,
  };
}

export function canUndoParkingJamSession(session: ParkingJamSession): boolean {
  return session.status === "playing" && session.history.length > 0;
}

export function canRestartParkingJamSession(
  session: ParkingJamSession,
): boolean {
  return session.status === "playing" && session.history.length > 0;
}

export function getParkingJamSessionElapsedMs(
  session: ParkingJamSession,
  now: number,
): number {
  return Math.max(0, (session.finishedAt ?? now) - session.startedAt);
}

export function getParkingJamSessionResult(
  session: ParkingJamSession,
  now: number,
): ParkingJamSessionResult | null {
  if (session.status !== "cleared") return null;

  return {
    elapsedMs: getParkingJamSessionElapsedMs(session, now),
    moveAttemptCount: session.moveAttemptCount,
    successfulMoveCount: session.successfulMoveCount,
    failedMoveCount: session.failedMoveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  };
}
