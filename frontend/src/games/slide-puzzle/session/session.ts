import type { SlidePuzzleProblem } from "@/games/slide-puzzle/problem/problem";
import {
  applySlidePuzzleSlide,
  getSlidePuzzleSlide,
} from "@/games/slide-puzzle/puzzle/rules";
import {
  isSlidePuzzleSolved,
  type SlidePuzzleBoard,
} from "@/games/slide-puzzle/puzzle/state";

type SlidePuzzleSessionStatus = "playing" | "cleared";

export type SlidePuzzleSession = {
  status: SlidePuzzleSessionStatus;
  problem: SlidePuzzleProblem;
  board: SlidePuzzleBoard;
  startedAt: number;
  finishedAt: number | null;
  /** 動いたタイルの枚数。盤面を戻す前の手も含む。 */
  moveCount: number;
  /** 最後に盤面を戻してから動いたタイルの枚数。 */
  completionMoveCount: number;
  /** 入力としてのスライド操作の回数。一括スライドも 1 回と数える。 */
  slideCount: number;
  restartCount: number;
};

export type SlidePuzzleSessionResult = {
  elapsedMs: number;
  moveCount: number;
  completionMoveCount: number;
  slideCount: number;
  restartCount: number;
};

export function createSlidePuzzleSession(
  problem: SlidePuzzleProblem,
  startedAt: number,
): SlidePuzzleSession {
  return {
    status: "playing",
    problem,
    board: problem.initialBoard,
    startedAt,
    finishedAt: null,
    moveCount: 0,
    completionMoveCount: 0,
    slideCount: 0,
    restartCount: 0,
  };
}

export function slideSlidePuzzleSessionTile(
  session: SlidePuzzleSession,
  tileIndex: number,
  movedAt: number,
): SlidePuzzleSession | null {
  if (session.status !== "playing") {
    return null;
  }

  const slide = getSlidePuzzleSlide(session.board, tileIndex);
  if (!slide) {
    return null;
  }

  const board = applySlidePuzzleSlide(session.board, slide);
  const cleared = isSlidePuzzleSolved(board);
  const movedTileCount = slide.movedTileIndices.length;
  return {
    ...session,
    status: cleared ? "cleared" : "playing",
    board,
    finishedAt: cleared ? movedAt : null,
    moveCount: session.moveCount + movedTileCount,
    completionMoveCount: session.completionMoveCount + movedTileCount,
    slideCount: session.slideCount + 1,
  };
}

/** 同じプレイのまま初期盤面へ戻す。経過時間と総手数は引き継ぐ。 */
export function restartSlidePuzzleSession(
  session: SlidePuzzleSession,
): SlidePuzzleSession {
  if (session.status !== "playing") {
    return session;
  }

  return {
    ...session,
    board: session.problem.initialBoard,
    completionMoveCount: 0,
    restartCount: session.restartCount + 1,
  };
}

export function getSlidePuzzleSessionElapsedMs(
  session: SlidePuzzleSession,
  now: number,
): number {
  return Math.max(0, (session.finishedAt ?? now) - session.startedAt);
}

export function getSlidePuzzleSessionResult(
  session: SlidePuzzleSession,
  now: number,
): SlidePuzzleSessionResult | null {
  if (session.status !== "cleared") {
    return null;
  }

  return {
    elapsedMs: getSlidePuzzleSessionElapsedMs(session, now),
    moveCount: session.moveCount,
    completionMoveCount: session.completionMoveCount,
    slideCount: session.slideCount,
    restartCount: session.restartCount,
  };
}
