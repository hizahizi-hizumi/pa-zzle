import { type GameSession, getClearedSessionElapsedMs } from "@/games/session";
import {
  assertSlidePuzzleProblem,
  type SlidePuzzleProblem,
} from "@/games/slide-puzzle/problem/problem";
import {
  applySlidePuzzleSlide,
  getSlidePuzzleSlide,
} from "@/games/slide-puzzle/puzzle/rules";
import {
  isSlidePuzzleSolved,
  type SlidePuzzleBoard,
} from "@/games/slide-puzzle/puzzle/state";

export type SlidePuzzleSession = GameSession<
  SlidePuzzleProblem,
  SlidePuzzleBoard
> & {
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
  assertSlidePuzzleProblem(problem);

  return {
    status: "playing",
    problem,
    puzzleState: problem.initialBoard,
    startedAt,
    finishedAt: null,
    moveCount: 0,
    completionMoveCount: 0,
    slideCount: 0,
    restartCount: 0,
  };
}

/** `tileIndex` のタイルを空白へ向けて滑らせる。滑らせられないタイルなら何もしない。 */
export function slideSlidePuzzleSessionTile(
  session: SlidePuzzleSession,
  tileIndex: number,
  movedAt: number,
): SlidePuzzleSession {
  if (session.status !== "playing") {
    return session;
  }

  const slide = getSlidePuzzleSlide(session.puzzleState, tileIndex);
  if (!slide) {
    return session;
  }

  const puzzleState = applySlidePuzzleSlide(session.puzzleState, slide);
  const cleared = isSlidePuzzleSolved(puzzleState);
  const movedTileCount = slide.movedTileIndices.length;
  return {
    ...session,
    status: cleared ? "cleared" : "playing",
    puzzleState,
    finishedAt: cleared ? movedAt : null,
    moveCount: session.moveCount + movedTileCount,
    completionMoveCount: session.completionMoveCount + movedTileCount,
    slideCount: session.slideCount + 1,
  };
}

/** 同じプレイのまま初期盤面へ戻す（盤面を戻す）。経過時間と総手数は引き継ぐ。 */
export function restartSlidePuzzleSession(
  session: SlidePuzzleSession,
): SlidePuzzleSession {
  if (!canRestartSlidePuzzleSession(session)) {
    return session;
  }

  return {
    ...session,
    puzzleState: session.problem.initialBoard,
    completionMoveCount: 0,
    restartCount: session.restartCount + 1,
  };
}

/** 盤面が初期盤面と違うプレイ中だけ、盤面を戻せる。 */
export function canRestartSlidePuzzleSession(
  session: SlidePuzzleSession,
): boolean {
  const { initialBoard } = session.problem;
  return (
    session.status === "playing" &&
    session.puzzleState.some((tile, index) => tile !== initialBoard[index])
  );
}

export function getSlidePuzzleSessionResult(
  session: SlidePuzzleSession,
): SlidePuzzleSessionResult | null {
  const elapsedMs = getClearedSessionElapsedMs(session);
  if (elapsedMs === null) {
    return null;
  }

  return {
    elapsedMs,
    moveCount: session.moveCount,
    completionMoveCount: session.completionMoveCount,
    slideCount: session.slideCount,
    restartCount: session.restartCount,
  };
}
