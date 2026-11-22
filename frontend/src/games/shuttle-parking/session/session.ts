import { type GameSession, getClearedSessionElapsedMs } from "@/games/session";
import {
  assertShuttleParkingProblem,
  type ShuttleParkingProblem,
} from "@/games/shuttle-parking/problem/problem";
import {
  createShuttleParkingClearability,
  type ShuttleParkingClearability,
} from "@/games/shuttle-parking/puzzle/clearability";
import type {
  ShuttleParkingCarId,
  ShuttleParkingSide,
} from "@/games/shuttle-parking/puzzle/lot";
import {
  createShuttleParkingInitialState,
  exitShuttleParkingCar,
  isShuttleParkingCleared,
  type ShuttleParkingBoardingEvent,
  type ShuttleParkingExitBlock,
  type ShuttleParkingState,
} from "@/games/shuttle-parking/puzzle/rules";

export type ShuttleParkingSession = GameSession<
  ShuttleParkingProblem,
  ShuttleParkingState
> & {
  history: readonly ShuttleParkingState[];
  exitCount: number;
  blockedExitCount: number;
  /** 全員を送り出せる状態から、送り出せない状態へ移した出庫の数。 */
  trapCount: number;
  undoCount: number;
  restartCount: number;
};

/** `ignored` は受け付けなかった操作で、session は変わらない。 */
export type ShuttleParkingSessionExitAttempt =
  | {
      outcome: "ignored";
      carId: ShuttleParkingCarId;
      session: ShuttleParkingSession;
    }
  | ({
      outcome: "blocked";
      carId: ShuttleParkingCarId;
      session: ShuttleParkingSession;
    } & ShuttleParkingExitBlock)
  | {
      outcome: "exited";
      carId: ShuttleParkingCarId;
      side: ShuttleParkingSide;
      events: readonly ShuttleParkingBoardingEvent[];
      session: ShuttleParkingSession;
    };

export type ShuttleParkingSessionResult = {
  elapsedMs: number;
  exitCount: number;
  blockedExitCount: number;
  trapCount: number;
  undoCount: number;
  restartCount: number;
};

const clearabilities = new WeakMap<
  ShuttleParkingProblem,
  ShuttleParkingClearability
>();

function getClearability(
  problem: ShuttleParkingProblem,
): ShuttleParkingClearability {
  const known = clearabilities.get(problem);
  if (known) return known;
  const created = createShuttleParkingClearability(problem);
  clearabilities.set(problem, created);
  return created;
}

export function createShuttleParkingSession(
  problem: ShuttleParkingProblem,
  startedAt: number,
): ShuttleParkingSession {
  assertShuttleParkingProblem(problem);

  return {
    status: "playing",
    problem,
    puzzleState: createShuttleParkingInitialState(problem),
    history: [],
    startedAt,
    clearedAt: null,
    exitCount: 0,
    blockedExitCount: 0,
    trapCount: 0,
    undoCount: 0,
    restartCount: 0,
  };
}

export function attemptShuttleParkingSessionExit(
  session: ShuttleParkingSession,
  carId: ShuttleParkingCarId,
  attemptedAt: number,
): ShuttleParkingSessionExitAttempt {
  if (session.status !== "playing") {
    return { outcome: "ignored", carId, session };
  }

  const exit = exitShuttleParkingCar(
    session.problem,
    session.puzzleState,
    carId,
  );
  switch (exit.outcome) {
    case "not-parked":
      return { outcome: "ignored", carId, session };
    case "blocked": {
      const { outcome, ...block } = exit;
      return {
        outcome,
        carId,
        ...block,
        session: {
          ...session,
          blockedExitCount: session.blockedExitCount + 1,
        },
      };
    }
    case "exited": {
      const { canClear } = getClearability(session.problem);
      const enteredTrap =
        canClear(session.puzzleState) && !canClear(exit.state);
      const cleared = isShuttleParkingCleared(session.problem, exit.state);
      return {
        outcome: "exited",
        carId,
        side: exit.side,
        events: exit.events,
        session: {
          ...session,
          status: cleared ? "cleared" : "playing",
          puzzleState: exit.state,
          history: [...session.history, session.puzzleState],
          clearedAt: cleared ? attemptedAt : null,
          exitCount: session.exitCount + 1,
          trapCount: session.trapCount + (enteredTrap ? 1 : 0),
        },
      };
    }
  }
}

export function undoShuttleParkingSession(
  session: ShuttleParkingSession,
): ShuttleParkingSession {
  if (!canUndoShuttleParkingSession(session)) return session;

  return {
    ...session,
    puzzleState: session.history.at(-1)!,
    history: session.history.slice(0, -1),
    undoCount: session.undoCount + 1,
  };
}

export function restartShuttleParkingSession(
  session: ShuttleParkingSession,
): ShuttleParkingSession {
  if (!canRestartShuttleParkingSession(session)) return session;

  return {
    ...session,
    puzzleState: createShuttleParkingInitialState(session.problem),
    history: [],
    restartCount: session.restartCount + 1,
  };
}

export function canUndoShuttleParkingSession(
  session: ShuttleParkingSession,
): boolean {
  return session.status === "playing" && session.history.length > 0;
}

/** 出た車は戻らないので、履歴があれば初期状態ではない。 */
export function canRestartShuttleParkingSession(
  session: ShuttleParkingSession,
): boolean {
  return session.status === "playing" && session.history.length > 0;
}

export function getShuttleParkingSessionResult(
  session: ShuttleParkingSession,
): ShuttleParkingSessionResult | null {
  const elapsedMs = getClearedSessionElapsedMs(session);
  if (elapsedMs === null) return null;

  return {
    elapsedMs,
    exitCount: session.exitCount,
    blockedExitCount: session.blockedExitCount,
    trapCount: session.trapCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  };
}
