import {
  assertIceFloorMazeProblem,
  type IceFloorMazeProblem,
} from "@/games/ice-floor-maze/problem/problem";
import {
  applyIceFloorMazeSlide,
  type IceFloorMazeDirection,
  type IceFloorMazeSlide,
  isIceFloorMazeCleared,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import {
  createIceFloorMazeInitialState,
  type IceFloorMazeState,
  isSameIceFloorMazeState,
} from "@/games/ice-floor-maze/puzzle/state";
import { type GameSession, getClearedSessionElapsedMs } from "@/games/session";

/** 今の盤面は、駒の位置と変化した要素を合わせた状態。 */
export type IceFloorMazeSession = GameSession<
  IceFloorMazeProblem,
  IceFloorMazeState
> & {
  /** 待ったで戻れる、これまでの状態。最後が直前の状態。盤面を戻すと空になる。 */
  history: readonly IceFloorMazeState[];
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
    puzzleState: createIceFloorMazeInitialState(problem.board, problem.start),
    history: [],
    startedAt,
    finishedAt: null,
    moveCount: 0,
    undoCount: 0,
    restartCount: 0,
  };
}

/** 駒を `direction` へ、止め役か外壁にぶつかるまで滑らせる。ゴールで止まればクリアになる。 */
export function slideIceFloorMazeSessionPiece(
  session: IceFloorMazeSession,
  direction: IceFloorMazeDirection,
  movedAt: number,
): IceFloorMazeSessionSlideAttempt {
  if (session.status !== "playing") {
    return { outcome: "ignored", session };
  }

  const { problem, puzzleState } = session;
  const slide = slideIceFloorMazePiece(problem.board, puzzleState, direction);
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
      puzzleState: applyIceFloorMazeSlide(puzzleState, slide),
      history: [...session.history, puzzleState],
      finishedAt: cleared ? movedAt : null,
      moveCount: session.moveCount + 1,
    },
  };
}

/** 駒と要素を直前の状態へ戻す。崩れたもろい岩・割れた薄い氷も戻る。総手数は減らさない。 */
export function undoIceFloorMazeSession(
  session: IceFloorMazeSession,
): IceFloorMazeSession {
  if (!canUndoIceFloorMazeSession(session)) {
    return session;
  }

  const previousState = session.history.at(-1)!;
  return {
    ...session,
    puzzleState: previousState,
    history: session.history.slice(0, -1),
    undoCount: session.undoCount + 1,
  };
}

/** 同じプレイのまま駒と要素を初期状態へ戻す（盤面を戻す）。経過時間と総手数は引き継ぐ。 */
export function restartIceFloorMazeSession(
  session: IceFloorMazeSession,
): IceFloorMazeSession {
  if (!canRestartIceFloorMazeSession(session)) {
    return session;
  }

  return {
    ...session,
    puzzleState: createIceFloorMazeInitialState(
      session.problem.board,
      session.problem.start,
    ),
    history: [],
    restartCount: session.restartCount + 1,
  };
}

export function canUndoIceFloorMazeSession(
  session: IceFloorMazeSession,
): boolean {
  return session.status === "playing" && session.history.length > 0;
}

/** 盤面が初期状態でない（駒が開始位置にいないか、要素が変わった）プレイ中だけ、盤面を戻せる。 */
export function canRestartIceFloorMazeSession(
  session: IceFloorMazeSession,
): boolean {
  const { problem, puzzleState } = session;
  return (
    session.status === "playing" &&
    !isSameIceFloorMazeState(
      puzzleState,
      createIceFloorMazeInitialState(problem.board, problem.start),
    )
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
