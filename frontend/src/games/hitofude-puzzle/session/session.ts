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

/**
 * 待ったで戻れる1単位。盤面操作（なぞり1回・矢印キー1回・巻き戻し）の前の道。
 * `undoStarted` は、待ったでこの単位へ戻り始めたか。待ったは1マスずつ戻すので、1単位を何回かの待ったで戻す。
 */
export type HitofudePuzzleHistoryEntry = {
  state: HitofudePuzzlePuzzleState;
  undoStarted: boolean;
};

export type HitofudePuzzleSession = GameSession<
  HitofudePuzzleProblem,
  HitofudePuzzlePuzzleState
> & {
  /**
   * 待ったで戻り始めた単位の数。待ったは1マスずつ戻すが、1単位を戻すのに何回押しても、その単位では1回と数える。
   * 道を変えた入力の回数を超えない。
   */
  undoCount: number;
  restartCount: number;
  /** 道を変えた入力（なぞり・矢印キー）の回数。待った・盤面を戻すは含まない。 */
  inputCount: number;
  backtrackCount: number;
  retractedCellCount: number;
  /**
   * 今の道を先頭に含む、これまでに引いた最も先までの道。引き直しを数える基準。
   * 道を戻しても残り、ここから外れたマスへ引くと、引いた道に置き換わる。
   */
  furthestPath: readonly number[];
  /** 待ったで戻せる、各盤面操作の前の道。古い順。 */
  history: readonly HitofudePuzzleHistoryEntry[];
  /**
   * 道をなぞっている間（押してから離すまで）だけ、押す前の道。
   * なぞる間の盤面操作は履歴に積まず、離したときに待ったの1単位としてまとめる。
   */
  strokeOrigin: HitofudePuzzlePuzzleState | null;
};

export type HitofudePuzzleSessionResult = {
  elapsedMs: number;
  backtrackCount: number;
  retractedCellCount: number;
  undoCount: number;
  restartCount: number;
  inputCount: number;
};

/** プレイ中でない session への操作は受け付けず、理由も添えない。 */
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
    clearedAt: null,
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

function commitInput(
  session: HitofudePuzzleSession,
  before: HitofudePuzzlePuzzleState,
): HitofudePuzzleSession {
  return {
    ...session,
    ...countPathTransition(session, before.path, session.puzzleState.path),
    history: [...session.history, { state: before, undoStarted: false }],
    inputCount: session.inputCount + 1,
  };
}

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
      ? { ...closeStroke(next), status: "cleared", clearedAt: operatedAt }
      : next,
    rejection: null,
  };
}

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

export function endHitofudePuzzleSessionStroke(
  session: HitofudePuzzleSession,
): HitofudePuzzleSession {
  return closeStroke(session);
}

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
 * 待った1回で戻す先の道。直前の単位の前の道（`target`）へ1マスだけ近づける。
 * 今の道が `target` から外れていれば先端を1マス消し、`target` の途中にあれば `target` に沿って1マス延ばす。
 */
function stepPathToward(
  path: readonly number[],
  target: readonly number[],
): readonly number[] {
  return path.length > countCommonPrefix(path, target)
    ? path.slice(0, -1)
    : target.slice(0, path.length + 1);
}

/**
 * 1マスずつ戻す。延ばした道は先端から1マスずつ消え、巻き戻した道は巻き戻す前の道へ1マスずつ延び直す。
 * 巻き戻しも取り消せる。盤面を戻す前の操作は待ったで戻せない。
 */
export function undoHitofudePuzzleSession(
  session: HitofudePuzzleSession,
): HitofudePuzzleSession {
  if (!canUndoHitofudePuzzleSession(session)) {
    return session;
  }

  const closed = closeStroke(session);
  const entry = closed.history.at(-1)!;
  const path = stepPathToward(closed.puzzleState.path, entry.state.path);
  const reached = haveSamePath({ path }, entry.state);
  return {
    ...closed,
    ...countPathTransition(closed, closed.puzzleState.path, path),
    puzzleState: reached ? entry.state : { path },
    history: reached
      ? closed.history.slice(0, -1)
      : [...closed.history.slice(0, -1), { ...entry, undoStarted: true }],
    undoCount: closed.undoCount + (entry.undoStarted ? 0 : 1),
  };
}

export function canUndoHitofudePuzzleSession(
  session: HitofudePuzzleSession,
): boolean {
  return (
    session.status === "playing" && closeStroke(session).history.length > 0
  );
}

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
