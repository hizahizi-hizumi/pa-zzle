import {
  assertFukumenzanProblem,
  type FukumenzanProblem,
} from "@/games/fukumenzan/problem/problem";
import { isFukumenzanSolved } from "@/games/fukumenzan/puzzle/rules";
import {
  createInitialFukumenzanState,
  type FukumenzanDigit,
  type FukumenzanPuzzleState,
  isInitialFukumenzanState,
} from "@/games/fukumenzan/puzzle/state";
import {
  placeFukumenzanDigit,
  returnFukumenzanDigit,
  toggleFukumenzanCross,
} from "@/games/fukumenzan/puzzle/transitions";
import { type GameSession, getClearedSessionElapsedMs } from "@/games/session";

export type FukumenzanSession = GameSession<
  FukumenzanProblem,
  FukumenzanPuzzleState
> & {
  undoCount: number;
  /** 盤面を戻した回数。 */
  restartCount: number;
  /** 札を文字へ入れた回数。運び直しと入れ替えも1回に数える。 */
  placeCount: number;
  /** 文字の札を列へ戻した回数。 */
  returnCount: number;
  /** × を付け外しした回数。 */
  crossToggleCount: number;
  /** 待ったで戻せる、各盤面操作の前の状態。古い順。 */
  history: readonly FukumenzanPuzzleState[];
};

export type FukumenzanSessionResult = {
  elapsedMs: number;
  undoCount: number;
  restartCount: number;
  placeCount: number;
  returnCount: number;
  crossToggleCount: number;
};

export function createFukumenzanSession(
  problem: FukumenzanProblem,
  startedAt: number,
): FukumenzanSession {
  assertFukumenzanProblem(problem);

  return {
    status: "playing",
    problem,
    puzzleState: createInitialFukumenzanState(problem),
    startedAt,
    clearedAt: null,
    undoCount: 0,
    restartCount: 0,
    placeCount: 0,
    returnCount: 0,
    crossToggleCount: 0,
    history: [],
  };
}

/** 盤面が変わったときだけ、前の状態を待ったの履歴に積む。 */
function applyOperation(
  session: FukumenzanSession,
  puzzleState: FukumenzanPuzzleState,
  counted: Partial<
    Pick<FukumenzanSession, "placeCount" | "returnCount" | "crossToggleCount">
  >,
): FukumenzanSession {
  if (puzzleState === session.puzzleState) {
    return session;
  }
  return {
    ...session,
    ...counted,
    puzzleState,
    history: [...session.history, session.puzzleState],
  };
}

export function placeFukumenzanSessionDigit(
  session: FukumenzanSession,
  letter: number,
  digit: FukumenzanDigit,
  operatedAt: number,
): FukumenzanSession {
  if (session.status !== "playing") {
    return session;
  }

  const changed = applyOperation(
    session,
    placeFukumenzanDigit(session.puzzleState, letter, digit),
    { placeCount: session.placeCount + 1 },
  );
  return changed !== session &&
    isFukumenzanSolved(changed.problem, changed.puzzleState)
    ? { ...changed, status: "cleared", clearedAt: operatedAt }
    : changed;
}

export function returnFukumenzanSessionDigit(
  session: FukumenzanSession,
  letter: number,
): FukumenzanSession {
  if (session.status !== "playing") {
    return session;
  }

  return applyOperation(
    session,
    returnFukumenzanDigit(session.puzzleState, letter),
    { returnCount: session.returnCount + 1 },
  );
}

export function toggleFukumenzanSessionCross(
  session: FukumenzanSession,
  letter: number,
  digit: FukumenzanDigit,
): FukumenzanSession {
  if (session.status !== "playing") {
    return session;
  }

  return applyOperation(
    session,
    toggleFukumenzanCross(session.puzzleState, letter, digit),
    { crossToggleCount: session.crossToggleCount + 1 },
  );
}

/** 盤面を戻す前の操作は戻せない。 */
export function undoFukumenzanSession(
  session: FukumenzanSession,
): FukumenzanSession {
  if (!canUndoFukumenzanSession(session)) {
    return session;
  }

  return {
    ...session,
    puzzleState: session.history.at(-1)!,
    history: session.history.slice(0, -1),
    undoCount: session.undoCount + 1,
  };
}

export function canUndoFukumenzanSession(session: FukumenzanSession): boolean {
  return session.status === "playing" && session.history.length > 0;
}

/** 札を全部列へ戻し、× も全部消す。 */
export function restartFukumenzanSession(
  session: FukumenzanSession,
): FukumenzanSession {
  if (!canRestartFukumenzanSession(session)) {
    return session;
  }

  return {
    ...session,
    puzzleState: createInitialFukumenzanState(session.problem),
    history: [],
    restartCount: session.restartCount + 1,
  };
}

export function canRestartFukumenzanSession(
  session: FukumenzanSession,
): boolean {
  return (
    session.status === "playing" &&
    !isInitialFukumenzanState(session.puzzleState)
  );
}

export function getFukumenzanSessionResult(
  session: FukumenzanSession,
): FukumenzanSessionResult | null {
  const elapsedMs = getClearedSessionElapsedMs(session);
  if (elapsedMs === null) {
    return null;
  }

  return {
    elapsedMs,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    placeCount: session.placeCount,
    returnCount: session.returnCount,
    crossToggleCount: session.crossToggleCount,
  };
}
