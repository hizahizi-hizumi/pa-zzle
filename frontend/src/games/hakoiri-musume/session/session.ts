import {
  assertHakoiriMusumeProblem,
  type HakoiriMusumeProblem,
} from "@/games/hakoiri-musume/problem/problem";
import {
  type HakoiriMusumeDirection,
  isHakoiriMusumeCleared,
  moveHakoiriMusumePiece,
} from "@/games/hakoiri-musume/puzzle/rules";
import {
  createHakoiriMusumeInitialState,
  type HakoiriMusumeState,
  isSameHakoiriMusumeBoard,
} from "@/games/hakoiri-musume/puzzle/state";
import { type GameSession, getClearedSessionElapsedMs } from "@/games/session";

/**
 * 1回のプレイ。1手は、同じ駒を続けて動かした1マスずつの移動をまとめたもの。指を離しても、次に同じ駒を動かせば同じ1手が続く。
 * 別の駒を動かす・待った・盤面を戻すで、今の1手は閉じる。
 */
export type HakoiriMusumeSession = GameSession<
  HakoiriMusumeProblem,
  HakoiriMusumeState
> & {
  /** 待ったで戻れる、今の盤面までの各手の前の盤面。古い順で、最後が今の1手の前の盤面。盤面を戻すと空になる。 */
  history: readonly HakoiriMusumeState[];
  /** 今の1手で動かしている駒（何番目の駒か）。この駒を動かすと同じ1手が続く。1手が閉じていれば `null`。 */
  openMovePiece: number | null;
  /** 指した手の数。待ったで取り消した手と、盤面を戻す前の手も含む。 */
  moveCount: number;
  undoCount: number;
  restartCount: number;
};

/**
 * 駒を1マス動かそうとした結果。`ignored`（プレイ中でない）と `blocked`（その向きの隣が箱の外か、ほかの駒）では session は変わらない。
 * `moved` は動いた駒の左上のマスの、動く前 `from` と後 `to` を持つ。
 */
export type HakoiriMusumeSessionStep =
  | { outcome: "ignored" | "blocked"; session: HakoiriMusumeSession }
  | {
      outcome: "moved";
      session: HakoiriMusumeSession;
      pieceIndex: number;
      from: number;
      to: number;
    };

export type HakoiriMusumeSessionResult = {
  elapsedMs: number;
  moveCount: number;
  undoCount: number;
  restartCount: number;
};

export function createHakoiriMusumeSession(
  problem: HakoiriMusumeProblem,
  startedAt: number,
): HakoiriMusumeSession {
  assertHakoiriMusumeProblem(problem);

  return {
    status: "playing",
    problem,
    puzzleState: createHakoiriMusumeInitialState(problem.pieces),
    history: [],
    openMovePiece: null,
    startedAt,
    finishedAt: null,
    moveCount: 0,
    undoCount: 0,
    restartCount: 0,
  };
}

/**
 * 今の1手を、動いた後の盤面で更新する。続けて動かしている駒が今の1手の前の位置へ戻ったら、
 * 盤面は1手の前と同じなので、その1手は指さなかったことにする。
 */
function continueOpenMove(
  session: HakoiriMusumeSession,
  pieceIndex: number,
  puzzleState: HakoiriMusumeState,
): HakoiriMusumeSession {
  const moveOrigin = session.history.at(-1)!;
  const returnedToOrigin =
    moveOrigin.pieces[pieceIndex]!.cell ===
    puzzleState.pieces[pieceIndex]!.cell;
  return returnedToOrigin
    ? {
        ...session,
        puzzleState,
        history: session.history.slice(0, -1),
        openMovePiece: null,
        moveCount: session.moveCount - 1,
      }
    : { ...session, puzzleState };
}

/**
 * 駒を `direction` へ1マス動かす。今の1手で動かしている駒なら同じ1手が続き、別の駒なら新しい1手を指す。
 * 娘が出口の前に着けばクリアになる。
 */
export function moveHakoiriMusumeSessionPiece(
  session: HakoiriMusumeSession,
  pieceIndex: number,
  direction: HakoiriMusumeDirection,
  movedAt: number,
): HakoiriMusumeSessionStep {
  if (session.status !== "playing") {
    return { outcome: "ignored", session };
  }

  const before = session.puzzleState;
  const after = moveHakoiriMusumePiece(before, pieceIndex, direction);
  if (!after) {
    return { outcome: "blocked", session };
  }

  const moved =
    session.openMovePiece === pieceIndex
      ? continueOpenMove(session, pieceIndex, after)
      : {
          ...session,
          puzzleState: after,
          history: [...session.history, before],
          openMovePiece: pieceIndex,
          moveCount: session.moveCount + 1,
        };
  const cleared = isHakoiriMusumeCleared(after);
  return {
    outcome: "moved",
    session: cleared
      ? { ...moved, status: "cleared", finishedAt: movedAt }
      : moved,
    pieceIndex,
    from: before.pieces[pieceIndex]!.cell,
    to: after.pieces[pieceIndex]!.cell,
  };
}

/** 直前の1手（同じ駒を続けて動かした分の全部）を取り消す。指した手の数は減らさない。 */
export function undoHakoiriMusumeSession(
  session: HakoiriMusumeSession,
): HakoiriMusumeSession {
  if (!canUndoHakoiriMusumeSession(session)) {
    return session;
  }

  return {
    ...session,
    puzzleState: session.history.at(-1)!,
    history: session.history.slice(0, -1),
    openMovePiece: null,
    undoCount: session.undoCount + 1,
  };
}

/** 同じプレイのまま駒を始めの並びへ戻す（盤面を戻す）。経過時間と指した手の数は引き継ぐ。 */
export function restartHakoiriMusumeSession(
  session: HakoiriMusumeSession,
): HakoiriMusumeSession {
  if (!canRestartHakoiriMusumeSession(session)) {
    return session;
  }

  return {
    ...session,
    puzzleState: createHakoiriMusumeInitialState(session.problem.pieces),
    history: [],
    openMovePiece: null,
    restartCount: session.restartCount + 1,
  };
}

export function canUndoHakoiriMusumeSession(
  session: HakoiriMusumeSession,
): boolean {
  return session.status === "playing" && session.history.length > 0;
}

/** 盤面が始めの並びと違うプレイ中だけ、盤面を戻せる。同じ種類の駒が入れ替わっただけなら始めの並びとみなす。 */
export function canRestartHakoiriMusumeSession(
  session: HakoiriMusumeSession,
): boolean {
  return (
    session.status === "playing" &&
    !isSameHakoiriMusumeBoard(
      session.puzzleState,
      createHakoiriMusumeInitialState(session.problem.pieces),
    )
  );
}

export function getHakoiriMusumeSessionResult(
  session: HakoiriMusumeSession,
): HakoiriMusumeSessionResult | null {
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
