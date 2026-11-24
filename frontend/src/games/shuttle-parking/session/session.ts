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
  /**
   * 全員を送り出せる状態から、送り出せない状態へ移した出庫（罠）の数。待った・盤面を戻すで戻して、同じ盤面から同じ車を
   * もう一度出したときは数え直さない（詰んだ原因を確かめ直す試行錯誤を、読みの失敗として重ねて数えない）。
   */
  trapCount: number;
  /** 数えた罠の、出す前の盤面と出した車の鍵。 */
  trapKeys: readonly string[];
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

function createTrapKey(
  { parkedCarIds, waitingCars, boardedCount }: ShuttleParkingState,
  carId: ShuttleParkingCarId,
): string {
  const waiting = waitingCars
    .map(({ carId: waitingId, seatedCount }) => `${waitingId}:${seatedCount}`)
    .join(",");
  return `${[...parkedCarIds].sort((a, b) => a - b).join(",")}|${waiting}|${boardedCount}|${carId}`;
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
    trapKeys: [],
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
      const trapKey = createTrapKey(session.puzzleState, carId);
      const enteredNewTrap =
        canClear(session.puzzleState) &&
        !canClear(exit.state) &&
        !session.trapKeys.includes(trapKey);
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
          trapCount: session.trapCount + (enteredNewTrap ? 1 : 0),
          trapKeys: enteredNewTrap
            ? [...session.trapKeys, trapKey]
            : session.trapKeys,
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
