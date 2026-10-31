import {
  assertIceFloorMazeProblem,
  type IceFloorMazeProblem,
} from "@/games/ice-floor-maze/problem/problem";
import {
  type IceFloorMazeDirection,
  type IceFloorMazeSlide,
  isIceFloorMazeCleared,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import { type GameSession, getClearedSessionElapsedMs } from "@/games/session";

/** 今の盤面は駒のいるマスの番号。 */
export type IceFloorMazeSession = GameSession<IceFloorMazeProblem, number> & {
  /** 待ったで戻れる、これまでに止まった位置。最後が直前の位置。盤面を戻すと空になる。 */
  history: readonly number[];
  /** 成立した滑りの回数。待ったで取り消した手と、盤面を戻す前の手も含む。 */
  moveCount: number;
  undoCount: number;
  restartCount: number;
};

/**
 * 駒を滑らせようとした結果。`ignored`（プレイ中でない）と `blocked`（1マスも動けない向き）では session は変わらない。
 * `slid` と `blocked` は、盤面へ伝える滑りの結果 `slide` を持つ。
 */
export type IceFloorMazeSessionSlideAttempt =
  | { outcome: "ignored"; session: IceFloorMazeSession }
  | {
      outcome: "slid" | "blocked";
      slide: IceFloorMazeSlide;
      session: IceFloorMazeSession;
    };

export type IceFloorMazeSessionResult = {
  elapsedMs: number;
  moveCount: number;
  undoCount: number;
  restartCount: number;
};

export function createIceFloorMazeSession(
  problem: IceFloorMazeProblem,
  startedAt: number,
): IceFloorMazeSession {
  assertIceFloorMazeProblem(problem);

  return {
    status: "playing",
    problem,
    puzzleState: problem.start,
    history: [],
    startedAt,
    finishedAt: null,
    moveCount: 0,
    undoCount: 0,
    restartCount: 0,
  };
}

/** 駒を `direction` へ、岩か外壁にぶつかるまで滑らせる。ゴールで止まればクリアになる。 */
export function slideIceFloorMazeSessionPiece(
  session: IceFloorMazeSession,
  direction: IceFloorMazeDirection,
  movedAt: number,
): IceFloorMazeSessionSlideAttempt {
  if (session.status !== "playing") {
    return { outcome: "ignored", session };
  }

  const { problem, puzzleState: position } = session;
  const slide = slideIceFloorMazePiece(problem.board, position, direction);
  if (slide.status === "blocked") {
    return { outcome: "blocked", slide, session };
  }

  const cleared = isIceFloorMazeCleared(slide.to, problem.goal);
  return {
    outcome: "slid",
    slide,
    session: {
      ...session,
      status: cleared ? "cleared" : "playing",
      puzzleState: slide.to,
      history: [...session.history, position],
      finishedAt: cleared ? movedAt : null,
      moveCount: session.moveCount + 1,
    },
  };
}

/** 駒を直前に止まっていた位置へ戻す。総手数は減らさない。 */
export function undoIceFloorMazeSession(
  session: IceFloorMazeSession,
): IceFloorMazeSession {
  if (!canUndoIceFloorMazeSession(session)) {
    return session;
  }

  const previousPosition = session.history.at(-1)!;
  return {
    ...session,
    puzzleState: previousPosition,
    history: session.history.slice(0, -1),
    undoCount: session.undoCount + 1,
  };
}

/** 同じプレイのまま駒を開始位置へ戻す（盤面を戻す）。経過時間と総手数は引き継ぐ。 */
export function restartIceFloorMazeSession(
  session: IceFloorMazeSession,
): IceFloorMazeSession {
  if (!canRestartIceFloorMazeSession(session)) {
    return session;
  }

  return {
    ...session,
    puzzleState: session.problem.start,
    history: [],
    restartCount: session.restartCount + 1,
  };
}

export function canUndoIceFloorMazeSession(
  session: IceFloorMazeSession,
): boolean {
  return session.status === "playing" && session.history.length > 0;
}

/** 駒が開始位置にいないプレイ中だけ、盤面を戻せる。 */
export function canRestartIceFloorMazeSession(
  session: IceFloorMazeSession,
): boolean {
  return (
    session.status === "playing" &&
    session.puzzleState !== session.problem.start
  );
}

export function getIceFloorMazeSessionResult(
  session: IceFloorMazeSession,
): IceFloorMazeSessionResult | null {
  const elapsedMs = getClearedSessionElapsedMs(session);
  if (elapsedMs === null) {
    return null;
  }

  return {
    elapsedMs,
    moveCount: session.moveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  };
}
