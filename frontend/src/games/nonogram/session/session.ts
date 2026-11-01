import {
  assertNonogramProblem,
  type NonogramProblem,
} from "@/games/nonogram/problem/problem";
import {
  createEmptyNonogramBoard,
  getNonogramLineCellIndices,
  type NonogramBoard,
  type NonogramCellState,
  type NonogramLine,
} from "@/games/nonogram/puzzle/board";
import { isNonogramSolved } from "@/games/nonogram/puzzle/rules";
import { type GameSession, getClearedSessionElapsedMs } from "@/games/session";

/** マスに入れる印。`filled` は塗り、`crossed` は ×。 */
export type NonogramMark = Exclude<NonogramCellState, "unknown">;

/**
 * 押してから離すまでの1回の入力。タップは始点のマスだけの入力になる。
 * - `erasing`: 始点のマスにすでに `mark` が入っていたので、印を消す入力。押している間は変えない。
 * - `line`: 入れる向きの行・列。始点から最初に別のマスへ動いたときに決め、押している間は変えない。
 * - `endCellIndex`: 今入れている範囲の終点。始点から終点までの `line` 上のマスに入れる。
 * - `boardBefore`: 押す前の盤面。範囲が縮んだマスはこの盤面へ戻す。
 */
type NonogramStroke = {
  mark: NonogramMark;
  erasing: boolean;
  startCellIndex: number;
  line: NonogramLine | null;
  endCellIndex: number;
  boardBefore: NonogramBoard;
};

export type NonogramSession = GameSession<NonogramProblem, NonogramBoard> & {
  stroke: NonogramStroke | null;
  /** 待ったで戻せる、入力の前の盤面。古い順。盤面を戻すと空にする。 */
  history: readonly NonogramBoard[];
  /** 盤面を押した回数。押してから離すまでを1回と数える。 */
  inputCount: number;
  /** 待ったで入力を取り消した回数。 */
  undoCount: number;
  /** 盤面を戻した回数。 */
  restartCount: number;
  /** 終えた入力・待った・盤面を戻すで塗りを消したマスの数。入力中のマスは `stroke` から数える。 */
  settledRepaintCount: number;
  /** 終えた入力で × を付けた・外したマスの数。入力中のマスは `stroke` から数える。 */
  settledCrossToggleCount: number;
};

/** 評価に使うプレイ事実。採点はしない。 */
export type NonogramSessionResult = {
  elapsedMs: number;
  repaintCount: number;
  crossToggleCount: number;
  undoCount: number;
  restartCount: number;
  inputCount: number;
};

export function createNonogramSession(
  problem: NonogramProblem,
  startedAt: number,
): NonogramSession {
  assertNonogramProblem(problem);

  return {
    status: "playing",
    problem,
    puzzleState: createEmptyNonogramBoard(problem),
    startedAt,
    finishedAt: null,
    stroke: null,
    history: [],
    inputCount: 0,
    undoCount: 0,
    restartCount: 0,
    settledRepaintCount: 0,
    settledCrossToggleCount: 0,
  };
}

type CellChange = (
  before: NonogramCellState,
  after: NonogramCellState,
) => boolean;

/** 塗りを未確定か × に変えた。 */
function isRepaint(before: NonogramCellState, after: NonogramCellState) {
  return before === "filled" && after !== "filled";
}

/** × を付けたか外した。 */
function isCrossToggle(before: NonogramCellState, after: NonogramCellState) {
  return (before === "crossed") !== (after === "crossed");
}

function countChangedCells(
  before: NonogramBoard,
  after: NonogramBoard,
  changed: CellChange,
): number {
  return before.cells.filter((state, cellIndex) =>
    changed(state, getCellState(after, cellIndex)),
  ).length;
}

/** 入力中のマスのうち、`changed` に当たるマスの数。入力中でなければ 0。 */
function countStrokeChangedCells(
  session: NonogramSession,
  changed: CellChange,
): number {
  return session.stroke === null
    ? 0
    : countChangedCells(
        session.stroke.boardBefore,
        session.puzzleState,
        changed,
      );
}

function settleStroke(session: NonogramSession): NonogramSession {
  if (session.stroke === null) {
    return session;
  }
  return {
    ...session,
    stroke: null,
    settledRepaintCount: getNonogramSessionRepaintCount(session),
    settledCrossToggleCount: getNonogramSessionCrossToggleCount(session),
  };
}

function getCellState(
  board: NonogramBoard,
  cellIndex: number,
): NonogramCellState {
  return board.cells[cellIndex] ?? "unknown";
}

/**
 * 入力がそのマスに入れる状態。始点は必ず変え、始点以外は始点と同じ変え方ができるマスだけを変える。
 * 印を入れる入力は未確定のマスだけに入れ、別の印のマスを上書きしない。印を消す入力は同じ印のマスだけを消す。
 */
function getStrokeCellState(
  stroke: NonogramStroke,
  cellIndex: number,
): NonogramCellState {
  const before = getCellState(stroke.boardBefore, cellIndex);
  if (stroke.erasing) {
    return before === stroke.mark ? "unknown" : before;
  }
  return cellIndex === stroke.startCellIndex || before === "unknown"
    ? stroke.mark
    : before;
}

/** 始点から終点までの、入力が入るマス。向きが決まる前は始点だけ。 */
function listStrokeCellIndices(
  board: NonogramBoard,
  stroke: NonogramStroke,
): number[] {
  if (stroke.line === null) {
    return [stroke.startCellIndex];
  }
  const lineCells = getNonogramLineCellIndices(board, stroke.line);
  const startPosition = lineCells.indexOf(stroke.startCellIndex);
  const endPosition = lineCells.indexOf(stroke.endCellIndex);
  return lineCells.slice(
    Math.min(startPosition, endPosition),
    Math.max(startPosition, endPosition) + 1,
  );
}

function drawStroke(stroke: NonogramStroke): NonogramBoard {
  const cells = [...stroke.boardBefore.cells];
  for (const cellIndex of listStrokeCellIndices(stroke.boardBefore, stroke)) {
    cells[cellIndex] = getStrokeCellState(stroke, cellIndex);
  }
  return { ...stroke.boardBefore, cells };
}

/** 入力で盤面を描き直す。揃えばクリアにし、入力を終える。 */
function applyStroke(
  session: NonogramSession,
  stroke: NonogramStroke,
  operatedAt: number,
): NonogramSession {
  const next: NonogramSession = {
    ...session,
    puzzleState: drawStroke(stroke),
    stroke,
  };
  if (!isNonogramSolved(next.puzzleState, session.problem.solution)) {
    return next;
  }
  return {
    ...settleStroke(next),
    status: "cleared",
    finishedAt: operatedAt,
  };
}

function isCellIndexOnBoard(board: NonogramBoard, cellIndex: number): boolean {
  return (
    Number.isInteger(cellIndex) &&
    cellIndex >= 0 &&
    cellIndex < board.cells.length
  );
}

/**
 * マスを押して入力を始める。押したマスにすでに `mark` が入っていれば印を消す入力、そうでなければ `mark` を入れる入力になる。
 * 押したマスはすぐに変わり、離すまでの入力全体を待ったの1手とする。
 */
export function startNonogramSessionStroke(
  session: NonogramSession,
  cellIndex: number,
  mark: NonogramMark,
  operatedAt: number,
): NonogramSession {
  if (
    session.status !== "playing" ||
    !isCellIndexOnBoard(session.puzzleState, cellIndex)
  ) {
    return session;
  }

  const settled = settleStroke(session);
  const board = settled.puzzleState;
  return applyStroke(
    {
      ...settled,
      history: [...settled.history, board],
      inputCount: settled.inputCount + 1,
    },
    {
      mark,
      erasing: getCellState(board, cellIndex) === mark,
      startCellIndex: cellIndex,
      line: null,
      endCellIndex: cellIndex,
      boardBefore: board,
    },
    operatedAt,
  );
}

/**
 * 始点から最初に動いたマスで、入れる向きの行・列を決める。斜めに動いたときは、大きく動いた向きにする。
 * 縦横に同じだけ動いたときは行にする。
 */
function decideStrokeLine(
  { width }: NonogramBoard,
  startCellIndex: number,
  cellIndex: number,
): NonogramLine {
  const startRow = Math.floor(startCellIndex / width);
  const startColumn = startCellIndex % width;
  const rowDistance = Math.abs(Math.floor(cellIndex / width) - startRow);
  const columnDistance = Math.abs((cellIndex % width) - startColumn);
  return rowDistance > columnDistance
    ? { axis: "column", index: startColumn }
    : { axis: "row", index: startRow };
}

/** 押しているマスを、入れる向きの行・列の上へ移したマス。行なら同じ列、列なら同じ行のマスになる。 */
function projectOntoStrokeLine(
  { width }: NonogramBoard,
  line: NonogramLine,
  cellIndex: number,
): number {
  return line.axis === "row"
    ? line.index * width + (cellIndex % width)
    : Math.floor(cellIndex / width) * width + line.index;
}

/**
 * 押したまま `cellIndex` のマスへ動かす。始点からそのマスまでの、入れる向きの行・列のマスに入力を入れる。
 * 戻って範囲が縮んだマスは押す前の状態へ戻す。入力中でなければ何もしない。
 */
export function extendNonogramSessionStroke(
  session: NonogramSession,
  cellIndex: number,
  operatedAt: number,
): NonogramSession {
  const { stroke, puzzleState: board } = session;
  if (
    session.status !== "playing" ||
    stroke === null ||
    !isCellIndexOnBoard(board, cellIndex) ||
    (stroke.line === null && cellIndex === stroke.startCellIndex)
  ) {
    return session;
  }

  const line =
    stroke.line ?? decideStrokeLine(board, stroke.startCellIndex, cellIndex);
  const endCellIndex = projectOntoStrokeLine(board, line, cellIndex);
  if (stroke.line !== null && endCellIndex === stroke.endCellIndex) {
    return session;
  }

  return applyStroke(session, { ...stroke, line, endCellIndex }, operatedAt);
}

/** 指を離して入力を終える。入力中でなければ何もしない。 */
export function endNonogramSessionStroke(
  session: NonogramSession,
): NonogramSession {
  return settleStroke(session);
}

/** 入力中の範囲の始点と、今の終点。 */
export type NonogramStrokeRange = {
  startCellIndex: number;
  endCellIndex: number;
};

/** 入力中なら、その範囲。入力中でなければ `null`。 */
export function getNonogramSessionStrokeRange(
  session: NonogramSession,
): NonogramStrokeRange | null {
  const { stroke } = session;
  return stroke === null
    ? null
    : {
        startCellIndex: stroke.startCellIndex,
        endCellIndex: stroke.endCellIndex,
      };
}

/**
 * 直前の入力を1つ取り消す（待った）。取り消して消えた塗りは塗り直しに数える。
 * 入力の回数は押した事実として戻さない。
 */
export function undoNonogramSession(session: NonogramSession): NonogramSession {
  if (!canUndoNonogramSession(session)) {
    return session;
  }

  const settled = settleStroke(session);
  const previous = settled.history.at(-1);
  if (previous === undefined) {
    return session;
  }
  return {
    ...settled,
    puzzleState: previous,
    history: settled.history.slice(0, -1),
    undoCount: settled.undoCount + 1,
    settledRepaintCount:
      settled.settledRepaintCount +
      countChangedCells(settled.puzzleState, previous, isRepaint),
  };
}

export function canUndoNonogramSession(session: NonogramSession): boolean {
  return session.status === "playing" && session.history.length > 0;
}

/**
 * 同じプレイのまま全マスを未確定へ戻す（盤面を戻す）。経過時間と記録は引き継ぐ。
 * 盤面を戻す操作そのものは減点しないが、消えた塗りは待ったと同じく塗り直しに数える。
 * 盤面を戻す前の入力は待ったで戻せない。
 */
export function restartNonogramSession(
  session: NonogramSession,
): NonogramSession {
  if (!canRestartNonogramSession(session)) {
    return session;
  }

  const settled = settleStroke(session);
  const emptyBoard = createEmptyNonogramBoard(session.problem);
  return {
    ...settled,
    puzzleState: emptyBoard,
    history: [],
    restartCount: settled.restartCount + 1,
    settledRepaintCount:
      settled.settledRepaintCount +
      countChangedCells(settled.puzzleState, emptyBoard, isRepaint),
  };
}

/** 塗りか × のあるプレイ中だけ、盤面を戻せる。 */
export function canRestartNonogramSession(session: NonogramSession): boolean {
  return (
    session.status === "playing" &&
    session.puzzleState.cells.some((state) => state !== "unknown")
  );
}

/** 塗りを未確定か × に変えたマスの数。待ったと盤面を戻すで消えた塗りも数える。 */
export function getNonogramSessionRepaintCount(
  session: NonogramSession,
): number {
  return (
    session.settledRepaintCount + countStrokeChangedCells(session, isRepaint)
  );
}

/** 入力で × を付けた・外したマスの数。待ったと盤面を戻すで変わった × は数えない。 */
export function getNonogramSessionCrossToggleCount(
  session: NonogramSession,
): number {
  return (
    session.settledCrossToggleCount +
    countStrokeChangedCells(session, isCrossToggle)
  );
}

export function getNonogramSessionResult(
  session: NonogramSession,
): NonogramSessionResult | null {
  const elapsedMs = getClearedSessionElapsedMs(session);
  if (elapsedMs === null) {
    return null;
  }

  return {
    elapsedMs,
    repaintCount: getNonogramSessionRepaintCount(session),
    crossToggleCount: getNonogramSessionCrossToggleCount(session),
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    inputCount: session.inputCount,
  };
}
