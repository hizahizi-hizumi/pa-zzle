import { type GameSession, getClearedSessionElapsedMs } from "@/games/session";
import {
  assertSolitaireProblem,
  type SolitaireProblem,
} from "@/games/solitaire/problem/problem";
import {
  applySolitaireMove,
  type SolitaireMove,
} from "@/games/solitaire/puzzle/rules";
import {
  createSolitaireInitialState,
  isSameSolitaireState,
  isSolitaireCleared,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";

/** 待ったで戻れる1手。`state` は手を打つ前の盤面。 */
export type SolitaireSessionStep = {
  state: SolitaireState;
  move: SolitaireMove;
};

export type SolitaireSession = GameSession<SolitaireProblem, SolitaireState> & {
  /** 待ったで戻れる、これまでの手。最後が直前の手。盤面を戻すと空になる。 */
  history: readonly SolitaireSessionStep[];
  /** 打った手の数。山札をめくる・捨て札を戻すも1手と数える。 */
  moveCount: number;
  undoCount: number;
  restartCount: number;
  /**
   * 取り消した、山札を押す手でない手の数。待ったで戻すと1手、盤面を戻すとそれまでに打って戻していない手の数だけ増える。
   * 山札をめくる・捨て札を戻す手は、札の並びを見る・取り出すための手間なので数えない。
   */
  retractedMoveCount: number;
};

export type SolitaireSessionResult = {
  elapsedMs: number;
  moveCount: number;
  undoCount: number;
  restartCount: number;
  retractedMoveCount: number;
};

function countRetractableMoves(steps: readonly SolitaireSessionStep[]): number {
  return steps.filter(({ move }) => move.kind === "transfer").length;
}

export function createSolitaireSession(
  problem: SolitaireProblem,
  startedAt: number,
): SolitaireSession {
  assertSolitaireProblem(problem);

  return {
    status: "playing",
    problem,
    puzzleState: createSolitaireInitialState(problem.columns, problem.stock),
    history: [],
    startedAt,
    clearedAt: null,
    moveCount: 0,
    undoCount: 0,
    restartCount: 0,
    retractedMoveCount: 0,
  };
}

/** 手を打つ。プレイ中でないか、今の盤面で打てない手なら、session を変えない。 */
export function applySolitaireSessionMove(
  session: SolitaireSession,
  move: SolitaireMove,
  movedAt: number,
): SolitaireSession {
  if (session.status !== "playing") {
    return session;
  }

  const puzzleState = applySolitaireMove(session.puzzleState, move);
  if (!puzzleState) {
    return session;
  }

  const cleared = isSolitaireCleared(puzzleState);
  return {
    ...session,
    status: cleared ? "cleared" : "playing",
    puzzleState,
    history: [...session.history, { state: session.puzzleState, move }],
    clearedAt: cleared ? movedAt : null,
    moveCount: session.moveCount + 1,
  };
}

export function undoSolitaireSession(
  session: SolitaireSession,
): SolitaireSession {
  if (!canUndoSolitaireSession(session)) {
    return session;
  }

  const lastStep = session.history.at(-1)!;
  return {
    ...session,
    puzzleState: lastStep.state,
    history: session.history.slice(0, -1),
    undoCount: session.undoCount + 1,
    retractedMoveCount:
      session.retractedMoveCount + countRetractableMoves([lastStep]),
  };
}

/** 同じプレイのまま、配った直後の盤面へ戻す（盤面を戻す）。経過時間と手数は引き継ぐ。 */
export function restartSolitaireSession(
  session: SolitaireSession,
): SolitaireSession {
  if (!canRestartSolitaireSession(session)) {
    return session;
  }

  return {
    ...session,
    puzzleState: createSolitaireInitialState(
      session.problem.columns,
      session.problem.stock,
    ),
    history: [],
    restartCount: session.restartCount + 1,
    retractedMoveCount:
      session.retractedMoveCount + countRetractableMoves(session.history),
  };
}

export function canUndoSolitaireSession(session: SolitaireSession): boolean {
  return session.status === "playing" && session.history.length > 0;
}

export function canRestartSolitaireSession(session: SolitaireSession): boolean {
  const { problem, puzzleState } = session;
  return (
    session.status === "playing" &&
    !isSameSolitaireState(
      puzzleState,
      createSolitaireInitialState(problem.columns, problem.stock),
    )
  );
}

export function getSolitaireSessionResult(
  session: SolitaireSession,
): SolitaireSessionResult | null {
  const elapsedMs = getClearedSessionElapsedMs(session);
  if (elapsedMs === null) {
    return null;
  }

  return {
    elapsedMs,
    moveCount: session.moveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    retractedMoveCount: session.retractedMoveCount,
  };
}
