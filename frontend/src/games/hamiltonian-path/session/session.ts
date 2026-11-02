import {
  assertHamiltonianPathProblem,
  type HamiltonianPathProblem,
} from "@/games/hamiltonian-path/problem/problem";
import { isHamiltonianPathSolved } from "@/games/hamiltonian-path/puzzle/rules";
import {
  createInitialHamiltonianPathState,
  type HamiltonianPathPuzzleState,
} from "@/games/hamiltonian-path/puzzle/state";
import {
  extendHamiltonianPath,
  type HamiltonianPathExtension,
  type HamiltonianPathExtensionRejection,
  type HamiltonianPathHeadMove,
  moveHamiltonianPathHead,
  rewindHamiltonianPath,
} from "@/games/hamiltonian-path/puzzle/transitions";
import { type GameSession, getClearedSessionElapsedMs } from "@/games/session";

export type HamiltonianPathSession = GameSession<
  HamiltonianPathProblem,
  HamiltonianPathPuzzleState
> & {
  /** 待ったで盤面操作を取り消した回数。 */
  undoCount: number;
  /** 盤面を戻した回数。 */
  restartCount: number;
  /** 待ったで戻せる、各盤面操作の前の道。古い順。盤面を戻すと空にする。 */
  history: readonly HamiltonianPathPuzzleState[];
};

/** 評価に使うプレイ事実。採点はしない。 */
export type HamiltonianPathSessionResult = {
  elapsedMs: number;
  undoCount: number;
  restartCount: number;
};

/**
 * 道を延ばす・先端を動かす操作の結果。延ばせなかったときは `rejection` に理由を添え、session は変えない。
 * プレイ中でない session への操作は受け付けず、理由も添えない。
 */
export type HamiltonianPathSessionPathChange = {
  session: HamiltonianPathSession;
  rejection: HamiltonianPathExtensionRejection | null;
};

export function createHamiltonianPathSession(
  problem: HamiltonianPathProblem,
  startedAt: number,
): HamiltonianPathSession {
  assertHamiltonianPathProblem(problem);

  return {
    status: "playing",
    problem,
    puzzleState: createInitialHamiltonianPathState(problem),
    startedAt,
    finishedAt: null,
    undoCount: 0,
    restartCount: 0,
    history: [],
  };
}

/** 道を変える盤面操作を1つ記録する。 */
function recordPathChange(
  session: HamiltonianPathSession,
  puzzleState: HamiltonianPathPuzzleState,
): HamiltonianPathSession {
  return {
    ...session,
    puzzleState,
    history: [...session.history, session.puzzleState],
  };
}

/** 延ばした道が全有効マスを通ったら、その時刻でクリアにする。 */
function applyPathMove(
  session: HamiltonianPathSession,
  move: HamiltonianPathExtension | HamiltonianPathHeadMove,
  operatedAt: number,
): HamiltonianPathSessionPathChange {
  if (move.kind === "rejected") {
    return { session, rejection: move.reason };
  }

  const next = recordPathChange(session, move.state);
  return {
    session: isHamiltonianPathSolved(session.problem, move.state.path)
      ? { ...next, status: "cleared", finishedAt: operatedAt }
      : next,
    rejection: null,
  };
}

/** 道の先端から隣のマスへ道を1マス延ばす。 */
export function extendHamiltonianPathSessionPath(
  session: HamiltonianPathSession,
  cell: number,
  operatedAt: number,
): HamiltonianPathSessionPathChange {
  if (session.status !== "playing") {
    return { session, rejection: null };
  }

  return applyPathMove(
    session,
    extendHamiltonianPath(session.problem, session.puzzleState, cell),
    operatedAt,
  );
}

/**
 * 道の先端を隣のマスへ動かす。直前のマスへ動かすと道が1マス縮み、それ以外は道を延ばす。
 * ドラッグと矢印キーで道を引くときの1マスぶんの操作。
 */
export function moveHamiltonianPathSessionHead(
  session: HamiltonianPathSession,
  cell: number,
  operatedAt: number,
): HamiltonianPathSessionPathChange {
  if (session.status !== "playing") {
    return { session, rejection: null };
  }

  return applyPathMove(
    session,
    moveHamiltonianPathHead(session.problem, session.puzzleState, cell),
    operatedAt,
  );
}

/** 道の途中のマス（始点を含む）まで道を巻き戻す。道に無いマスや先端なら何もしない。 */
export function rewindHamiltonianPathSessionPath(
  session: HamiltonianPathSession,
  cell: number,
): HamiltonianPathSession {
  if (session.status !== "playing") {
    return session;
  }

  const puzzleState = rewindHamiltonianPath(session.puzzleState, cell);
  return puzzleState === session.puzzleState
    ? session
    : recordPathChange(session, puzzleState);
}

/**
 * 直前の盤面操作を1つ取り消す（待った）。巻き戻しも取り消せる。
 * 盤面を戻す前の操作は待ったで戻せない。
 */
export function undoHamiltonianPathSession(
  session: HamiltonianPathSession,
): HamiltonianPathSession {
  if (!canUndoHamiltonianPathSession(session)) {
    return session;
  }

  return {
    ...session,
    puzzleState: session.history.at(-1)!,
    history: session.history.slice(0, -1),
    undoCount: session.undoCount + 1,
  };
}

export function canUndoHamiltonianPathSession(
  session: HamiltonianPathSession,
): boolean {
  return session.status === "playing" && session.history.length > 0;
}

/** 同じプレイのまま道を始点だけに戻す（盤面を戻す）。経過時間は引き継ぎ、待ったの履歴は消す。 */
export function restartHamiltonianPathSession(
  session: HamiltonianPathSession,
): HamiltonianPathSession {
  if (!canRestartHamiltonianPathSession(session)) {
    return session;
  }

  return {
    ...session,
    puzzleState: createInitialHamiltonianPathState(session.problem),
    history: [],
    restartCount: session.restartCount + 1,
  };
}

/** 道が始点から延びているプレイ中だけ、盤面を戻せる。 */
export function canRestartHamiltonianPathSession(
  session: HamiltonianPathSession,
): boolean {
  return session.status === "playing" && session.puzzleState.path.length > 1;
}

export function getHamiltonianPathSessionResult(
  session: HamiltonianPathSession,
): HamiltonianPathSessionResult | null {
  const elapsedMs = getClearedSessionElapsedMs(session);
  if (elapsedMs === null) {
    return null;
  }

  return {
    elapsedMs,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  };
}
