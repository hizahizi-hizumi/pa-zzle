import {
  assertHitofudePuzzleProblem,
  type HitofudePuzzleProblem,
} from "@/games/hitofude-puzzle/problem/problem";
import {
  getHitofudePuzzleNeighborCell,
  type HitofudePuzzleDirection,
} from "@/games/hitofude-puzzle/puzzle/board";
import { isHitofudePuzzleSolved } from "@/games/hitofude-puzzle/puzzle/rules";
import {
  createInitialHitofudePuzzleState,
  getHitofudePuzzleHead,
  type HitofudePuzzlePuzzleState,
} from "@/games/hitofude-puzzle/puzzle/state";
import {
  extendHitofudePuzzle,
  type HitofudePuzzleExtension,
  type HitofudePuzzleExtensionRejection,
  type HitofudePuzzleHeadMove,
  type HitofudePuzzleTraceStep,
  moveHitofudePuzzleHead,
  rewindHitofudePuzzle,
  traceHitofudePuzzle,
} from "@/games/hitofude-puzzle/puzzle/transitions";
import { type GameSession, getClearedSessionElapsedMs } from "@/games/session";

export type HitofudePuzzleSession = GameSession<
  HitofudePuzzleProblem,
  HitofudePuzzlePuzzleState
> & {
  /** 待ったで盤面操作を取り消した回数。 */
  undoCount: number;
  /** 盤面を戻した回数。 */
  restartCount: number;
  /** 道を変えた入力（なぞり・矢印キー）の回数。待った・盤面を戻すは含まない。 */
  inputCount: number;
  /**
   * 引き直しの回数。道を戻した後、戻した位置から前と別のマスへ引いたときに1回と数える。
   * 前と同じマスへ引き直したとき（手ぶれ・確かめ）は数えない。どの操作で戻したかは問わない。
   */
  backtrackCount: number;
  /** 戻したマスの数の合計。 */
  retractedCellCount: number;
  /**
   * 今の道を先頭に含む、これまでに引いた最も先までの道。引き直しを数える基準。
   * 道を戻しても残り、ここから外れたマスへ引くと、引いた道に置き換わる。
   */
  furthestPath: readonly number[];
  /** 待ったで戻せる、各盤面操作の前の道。古い順。盤面を戻すと空にする。 */
  history: readonly HitofudePuzzlePuzzleState[];
  /**
   * 道をなぞっている間（押してから離すまで）だけ、押す前の道。
   * なぞる間の盤面操作は履歴に積まず、離したときに待ったの1単位としてまとめる。
   */
  strokeOrigin: HitofudePuzzlePuzzleState | null;
};

/**
 * 評価に使うプレイ事実。採点はしない。
 * 引き直しの回数を正確さに使い、戻したマスの数・待った・盤面を戻した回数・入力回数は記録にだけ残す。
 */
export type HitofudePuzzleSessionResult = {
  elapsedMs: number;
  backtrackCount: number;
  retractedCellCount: number;
  undoCount: number;
  restartCount: number;
  inputCount: number;
};

/**
 * 道を延ばす・先端を動かす操作の結果。延ばせなかったときは `rejection` に理由を添え、道は変えない。
 * プレイ中でない session への操作は受け付けず、理由も添えない。
 */
export type HitofudePuzzleSessionPathChange = {
  session: HitofudePuzzleSession;
  rejection: HitofudePuzzleExtensionRejection | null;
};

export function createHitofudePuzzleSession(
  problem: HitofudePuzzleProblem,
  startedAt: number,
): HitofudePuzzleSession {
  assertHitofudePuzzleProblem(problem);
  const puzzleState = createInitialHitofudePuzzleState(problem);

  return {
    status: "playing",
    problem,
    puzzleState,
    startedAt,
    finishedAt: null,
    undoCount: 0,
    restartCount: 0,
    inputCount: 0,
    backtrackCount: 0,
    retractedCellCount: 0,
    furthestPath: puzzleState.path,
    history: [],
    strokeOrigin: null,
  };
}

function countCommonPrefix(
  left: readonly number[],
  right: readonly number[],
): number {
  let length = 0;
  while (
    length < left.length &&
    length < right.length &&
    left[length] === right[length]
  ) {
    length += 1;
  }
  return length;
}

type PathTransitionCounts = Pick<
  HitofudePuzzleSession,
  "backtrackCount" | "retractedCellCount" | "furthestPath"
>;

/**
 * 道が `before` から `after` へ変わった1単位（なぞり1回・矢印キー1回・待った・盤面を戻す）で、引き直しと戻したマスを数える。
 * なぞりの途中の行き来は数えず、押す前と離した後の道だけを比べるので、1回のなぞりの中の手ぶれは引き直しにならない。
 */
function countPathTransition(
  session: HitofudePuzzleSession,
  before: readonly number[],
  after: readonly number[],
): PathTransitionCounts {
  const { furthestPath } = session;
  const sharedLength = countCommonPrefix(furthestPath, after);
  const leftFurthestPath =
    sharedLength < after.length && sharedLength < furthestPath.length;
  return {
    backtrackCount: session.backtrackCount + (leftFurthestPath ? 1 : 0),
    retractedCellCount:
      session.retractedCellCount +
      before.length -
      countCommonPrefix(before, after),
    furthestPath:
      leftFurthestPath || after.length > furthestPath.length
        ? after
        : furthestPath,
  };
}

/** 入力1回ぶんの道の変化を、`before` を待ったの1単位として記録し、引き直しを数える。 */
function commitInput(
  session: HitofudePuzzleSession,
  before: HitofudePuzzlePuzzleState,
): HitofudePuzzleSession {
  return {
    ...session,
    ...countPathTransition(session, before.path, session.puzzleState.path),
    history: [...session.history, before],
    inputCount: session.inputCount + 1,
  };
}

/** 道を変える盤面操作を記録する。なぞっている間は、離したときにまとめて記録する。 */
function recordPathChange(
  session: HitofudePuzzleSession,
  puzzleState: HitofudePuzzlePuzzleState,
): HitofudePuzzleSession {
  const changed = { ...session, puzzleState };
  return session.strokeOrigin === null
    ? commitInput(changed, session.puzzleState)
    : changed;
}

function haveSamePath(
  left: HitofudePuzzlePuzzleState,
  right: HitofudePuzzlePuzzleState,
): boolean {
  return (
    left.path.length === right.path.length &&
    left.path.every((cell, index) => right.path[index] === cell)
  );
}

/** なぞりを終え、道が変わっていれば押す前の道を待ったの1単位として記録し、引き直しを数える。 */
function closeStroke(session: HitofudePuzzleSession): HitofudePuzzleSession {
  const { strokeOrigin } = session;
  if (strokeOrigin === null) {
    return session;
  }
  const closed = { ...session, strokeOrigin: null };
  return haveSamePath(strokeOrigin, session.puzzleState)
    ? closed
    : commitInput(closed, strokeOrigin);
}

/** 延ばした道が全有効マスを通ったら、その時刻でクリアにする。クリアしたらなぞりも終える。 */
function applyPathMove(
  session: HitofudePuzzleSession,
  move: HitofudePuzzleExtension | HitofudePuzzleHeadMove,
  operatedAt: number,
): HitofudePuzzleSessionPathChange {
  if (move.kind === "rejected") {
    return { session, rejection: move.reason };
  }

  const next = recordPathChange(session, move.state);
  return {
    session: isHitofudePuzzleSolved(session.problem, move.state.path)
      ? { ...closeStroke(next), status: "cleared", finishedAt: operatedAt }
      : next,
    rejection: null,
  };
}

/** 道の先端から隣のマスへ道を1マス延ばす。 */
export function extendHitofudePuzzleSessionPath(
  session: HitofudePuzzleSession,
  cell: number,
  operatedAt: number,
): HitofudePuzzleSessionPathChange {
  if (session.status !== "playing") {
    return { session, rejection: null };
  }

  return applyPathMove(
    session,
    extendHitofudePuzzle(session.problem, session.puzzleState, cell),
    operatedAt,
  );
}

/**
 * 道の先端を隣のマスへ動かす。直前のマスへ動かすと道が1マス縮み、それ以外は道を延ばす。
 * ドラッグと矢印キーで道を引くときの1マスぶんの操作。
 */
export function moveHitofudePuzzleSessionHead(
  session: HitofudePuzzleSession,
  cell: number,
  operatedAt: number,
): HitofudePuzzleSessionPathChange {
  if (session.status !== "playing") {
    return { session, rejection: null };
  }

  return applyPathMove(
    session,
    moveHitofudePuzzleHead(session.problem, session.puzzleState, cell),
    operatedAt,
  );
}

/** 先端から `direction` の向きの隣のマスへ先端を動かす。矢印キーの1回の操作。 */
export function moveHitofudePuzzleSessionHeadToward(
  session: HitofudePuzzleSession,
  direction: HitofudePuzzleDirection,
  operatedAt: number,
): HitofudePuzzleSessionPathChange {
  if (session.status !== "playing") {
    return { session, rejection: null };
  }

  const neighbor = getHitofudePuzzleNeighborCell(
    session.problem.size,
    getHitofudePuzzleHead(session.puzzleState),
    direction,
  );
  return neighbor === null
    ? { session, rejection: "outside-board" }
    : moveHitofudePuzzleSessionHead(session, neighbor, operatedAt);
}

/**
 * 盤面のマスを押して、道をなぞり始める。
 * 道のマスを押すとそこまで巻き戻し（先端なら変えない）、先端に隣り合うマスを押すとそこへ延ばす。
 * 延ばせないマスを押したときも押す前の道からなぞり始め、延ばせなかった理由を返す。
 * 道から外れた指でも、先端の隣へ戻ればそこから延ばせる。
 */
export function beginHitofudePuzzleSessionStroke(
  session: HitofudePuzzleSession,
  cell: number,
  operatedAt: number,
): HitofudePuzzleSessionPathChange {
  if (session.status !== "playing") {
    return { session, rejection: null };
  }

  const closed = closeStroke(session);
  const stroking = { ...closed, strokeOrigin: closed.puzzleState };
  if (closed.puzzleState.path.includes(cell)) {
    return {
      session: rewindHitofudePuzzleSessionPath(stroking, cell),
      rejection: null,
    };
  }
  return extendHitofudePuzzleSessionPath(stroking, cell, operatedAt);
}

/** なぞっている指が隣のマスへ移ったときに道を変える。なぞっていなければ何もしない。 */
export function traceHitofudePuzzleSessionStroke(
  session: HitofudePuzzleSession,
  step: HitofudePuzzleTraceStep,
  operatedAt: number,
): HitofudePuzzleSessionPathChange {
  if (session.status !== "playing" || session.strokeOrigin === null) {
    return { session, rejection: null };
  }

  const trace = traceHitofudePuzzle(session.problem, session.puzzleState, step);
  return trace.kind === "unchanged"
    ? { session, rejection: null }
    : applyPathMove(session, trace, operatedAt);
}

/** 指を離してなぞりを終える。なぞる間に変えた道を、待ったの1単位にする。 */
export function endHitofudePuzzleSessionStroke(
  session: HitofudePuzzleSession,
): HitofudePuzzleSession {
  return closeStroke(session);
}

/** 道の途中のマス（始点を含む）まで道を巻き戻す。道に無いマスや先端なら何もしない。 */
export function rewindHitofudePuzzleSessionPath(
  session: HitofudePuzzleSession,
  cell: number,
): HitofudePuzzleSession {
  if (session.status !== "playing") {
    return session;
  }

  const puzzleState = rewindHitofudePuzzle(session.puzzleState, cell);
  return puzzleState === session.puzzleState
    ? session
    : recordPathChange(session, puzzleState);
}

/**
 * 直前の盤面操作を1つ取り消す（待った）。巻き戻しも取り消せる。
 * 盤面を戻す前の操作は待ったで戻せない。待ったで前の道筋へ戻したときも、別のマスへ引いたのと同じに引き直しを数える。
 */
export function undoHitofudePuzzleSession(
  session: HitofudePuzzleSession,
): HitofudePuzzleSession {
  if (!canUndoHitofudePuzzleSession(session)) {
    return session;
  }

  const closed = closeStroke(session);
  const puzzleState = closed.history.at(-1)!;
  return {
    ...closed,
    ...countPathTransition(closed, closed.puzzleState.path, puzzleState.path),
    puzzleState,
    history: closed.history.slice(0, -1),
    undoCount: closed.undoCount + 1,
  };
}

export function canUndoHitofudePuzzleSession(
  session: HitofudePuzzleSession,
): boolean {
  return (
    session.status === "playing" && closeStroke(session).history.length > 0
  );
}

/** 同じプレイのまま道を始点だけに戻す（盤面を戻す）。経過時間は引き継ぎ、待ったの履歴は消す。 */
export function restartHitofudePuzzleSession(
  session: HitofudePuzzleSession,
): HitofudePuzzleSession {
  if (!canRestartHitofudePuzzleSession(session)) {
    return session;
  }

  const closed = closeStroke(session);
  const puzzleState = createInitialHitofudePuzzleState(closed.problem);
  return {
    ...closed,
    ...countPathTransition(closed, closed.puzzleState.path, puzzleState.path),
    puzzleState,
    history: [],
    restartCount: closed.restartCount + 1,
  };
}

/** 道が始点から延びているプレイ中だけ、盤面を戻せる。 */
export function canRestartHitofudePuzzleSession(
  session: HitofudePuzzleSession,
): boolean {
  return session.status === "playing" && session.puzzleState.path.length > 1;
}

export function getHitofudePuzzleSessionResult(
  session: HitofudePuzzleSession,
): HitofudePuzzleSessionResult | null {
  const elapsedMs = getClearedSessionElapsedMs(session);
  if (elapsedMs === null) {
    return null;
  }

  return {
    elapsedMs,
    backtrackCount: session.backtrackCount,
    retractedCellCount: session.retractedCellCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    inputCount: session.inputCount,
  };
}
