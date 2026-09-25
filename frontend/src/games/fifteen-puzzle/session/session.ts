import type { FifteenPuzzleProblem } from "@/games/fifteen-puzzle/problem/problem";
import {
  applyFifteenPuzzleSlide,
  getFifteenPuzzleSlide,
} from "@/games/fifteen-puzzle/puzzle/rules";
import {
  type FifteenPuzzleBoard,
  isFifteenPuzzleSolved,
} from "@/games/fifteen-puzzle/puzzle/state";

type FifteenPuzzleSessionStatus = "playing" | "cleared";

export type FifteenPuzzleSession = {
  status: FifteenPuzzleSessionStatus;
  problem: FifteenPuzzleProblem;
  board: FifteenPuzzleBoard;
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

export type FifteenPuzzleSessionResult = {
  elapsedMs: number;
  moveCount: number;
  completionMoveCount: number;
  slideCount: number;
  restartCount: number;
};

export function createFifteenPuzzleSession(
  problem: FifteenPuzzleProblem,
  startedAt: number,
): FifteenPuzzleSession {
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

export function slideFifteenPuzzleSessionTile(
  session: FifteenPuzzleSession,
  tileIndex: number,
  movedAt: number,
): FifteenPuzzleSession | null {
  if (session.status !== "playing") {
    return null;
  }

  const slide = getFifteenPuzzleSlide(session.board, tileIndex);
  if (!slide) {
    return null;
  }

  const board = applyFifteenPuzzleSlide(session.board, slide);
  const cleared = isFifteenPuzzleSolved(board);
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
export function restartFifteenPuzzleSession(
  session: FifteenPuzzleSession,
): FifteenPuzzleSession {
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

export function getFifteenPuzzleSessionElapsedMs(
  session: FifteenPuzzleSession,
  now: number,
): number {
  return Math.max(0, (session.finishedAt ?? now) - session.startedAt);
}

export function getFifteenPuzzleSessionResult(
  session: FifteenPuzzleSession,
  now: number,
): FifteenPuzzleSessionResult | null {
  if (session.status !== "cleared") {
    return null;
  }

  return {
    elapsedMs: getFifteenPuzzleSessionElapsedMs(session, now),
    moveCount: session.moveCount,
    completionMoveCount: session.completionMoveCount,
    slideCount: session.slideCount,
    restartCount: session.restartCount,
  };
}
