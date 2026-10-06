import { type GameSession, getClearedSessionElapsedMs } from "@/games/session";
import {
  assertWaterSortProblem,
  type WaterSortProblem,
} from "@/games/water-sort/problem/problem";
import {
  applyWaterSortMove,
  listWaterSortLegalMoves,
} from "@/games/water-sort/puzzle/rules";
import {
  isWaterSortCleared,
  type WaterSortMove,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";

export type WaterSortSession = GameSession<WaterSortProblem, WaterSortState> & {
  history: readonly WaterSortState[];
  moveCount: number;
  undoCount: number;
  restartCount: number;
};

export type WaterSortSessionResult = {
  elapsedMs: number;
  moveCount: number;
  completionMoveCount: number;
  undoCount: number;
  restartCount: number;
};

export function createWaterSortSession(
  problem: WaterSortProblem,
  startedAt: number,
): WaterSortSession {
  assertWaterSortProblem(problem);

  return {
    status: "playing",
    problem,
    puzzleState: problem.initialState,
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
    ? listWaterSortLegalMoves(session.puzzleState)
    : [];
}

/** 注ぐ。注げない組み合わせなら何もしない。 */
export function applyWaterSortSessionMove(
  session: WaterSortSession,
  move: WaterSortMove,
  movedAt: number,
): WaterSortSession {
  if (session.status !== "playing") {
    return session;
  }

  const puzzleState = applyWaterSortMove(session.puzzleState, move);
  if (!puzzleState) {
    return session;
  }

  const cleared = isWaterSortCleared(puzzleState);
  return {
    ...session,
    status: cleared ? "cleared" : "playing",
    puzzleState,
    history: [...session.history, session.puzzleState],
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
    puzzleState: previousState,
    history: session.history.slice(0, -1),
    undoCount: session.undoCount + 1,
  };
}

/** 同じプレイのまま初期状態へ戻す（盤面を戻す）。経過時間と記録は引き継ぐ。 */
export function restartWaterSortSession(
  session: WaterSortSession,
): WaterSortSession {
  if (!canRestartWaterSortSession(session)) {
    return session;
  }

  return {
    ...session,
    puzzleState: session.problem.initialState,
    history: [],
    restartCount: session.restartCount + 1,
  };
}

export function canUndoWaterSortSession(session: WaterSortSession): boolean {
  return session.status === "playing" && session.history.length > 0;
}

/** 瓶の中身が初期状態と違うプレイ中だけ、盤面を戻せる。 */
export function canRestartWaterSortSession(session: WaterSortSession): boolean {
  const { initialState } = session.problem;
  return (
    session.status === "playing" &&
    session.puzzleState.some((bottle, bottleIndex) => {
      const initialBottle = initialState[bottleIndex] ?? [];
      return (
        bottle.length !== initialBottle.length ||
        bottle.some((color, layerIndex) => color !== initialBottle[layerIndex])
      );
    })
  );
}

export function getWaterSortSessionResult(
  session: WaterSortSession,
): WaterSortSessionResult | null {
  const elapsedMs = getClearedSessionElapsedMs(session);
  if (elapsedMs === null) {
    return null;
  }

  return {
    elapsedMs,
    moveCount: session.moveCount,
    completionMoveCount: session.history.length,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  };
}
