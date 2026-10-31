import {
  assertParkingJamProblem,
  type ParkingJamProblem,
} from "@/games/parking-jam/problem/problem";
import {
  createParkingJamInitialState,
  isParkingJamCleared,
  type ParkingJamMove,
  type ParkingJamState,
} from "@/games/parking-jam/puzzle/board";
import {
  applyParkingJamMove,
  listParkingJamMoveBlockers,
  type ParkingJamMoveBlocker,
} from "@/games/parking-jam/puzzle/rules";
import { type GameSession, getClearedSessionElapsedMs } from "@/games/session";

export type ParkingJamSession = GameSession<
  ParkingJamProblem,
  ParkingJamState
> & {
  history: readonly ParkingJamState[];
  moveAttemptCount: number;
  successfulMoveCount: number;
  failedMoveCount: number;
  undoCount: number;
  restartCount: number;
};

/** 車を動かそうとした結果。`ignored` は受け付けなかった操作で、session は変わらない。 */
export type ParkingJamSessionMoveAttempt =
  | {
      outcome: "ignored";
      move: ParkingJamMove;
      session: ParkingJamSession;
    }
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
  assertParkingJamProblem(problem);

  return {
    status: "playing",
    problem,
    puzzleState: createParkingJamInitialState(problem.board),
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
): ParkingJamSessionMoveAttempt {
  if (session.status !== "playing") {
    return { outcome: "ignored", move, session };
  }

  const blockers = listParkingJamMoveBlockers(
    session.problem.board,
    session.puzzleState,
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

  const puzzleState = applyParkingJamMove(
    session.problem.board,
    session.puzzleState,
    move,
  );
  if (!puzzleState) {
    return { outcome: "ignored", move, session };
  }

  const cleared = isParkingJamCleared(puzzleState);
  return {
    outcome: "exited",
    move,
    session: {
      ...session,
      status: cleared ? "cleared" : "playing",
      puzzleState,
      history: [...session.history, session.puzzleState],
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
    puzzleState: previousState,
    history: session.history.slice(0, -1),
    undoCount: session.undoCount + 1,
  };
}

/** 同じプレイのまま盤面を初期状態へ戻す（盤面を戻す）。経過時間と記録は引き継ぐ。 */
export function restartParkingJamSession(
  session: ParkingJamSession,
): ParkingJamSession {
  if (!canRestartParkingJamSession(session)) return session;

  return {
    ...session,
    puzzleState: createParkingJamInitialState(session.problem.board),
    history: [],
    restartCount: session.restartCount + 1,
  };
}

export function canUndoParkingJamSession(session: ParkingJamSession): boolean {
  return session.status === "playing" && session.history.length > 0;
}

/** 車が出た後のプレイ中だけ、盤面を戻せる。車は戻らないので、履歴があれば初期状態ではない。 */
export function canRestartParkingJamSession(
  session: ParkingJamSession,
): boolean {
  return session.status === "playing" && session.history.length > 0;
}

export function getParkingJamSessionResult(
  session: ParkingJamSession,
): ParkingJamSessionResult | null {
  const elapsedMs = getClearedSessionElapsedMs(session);
  if (elapsedMs === null) return null;

  return {
    elapsedMs,
    moveAttemptCount: session.moveAttemptCount,
    successfulMoveCount: session.successfulMoveCount,
    failedMoveCount: session.failedMoveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  };
}
