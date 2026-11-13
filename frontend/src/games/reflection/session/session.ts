import {
  assertReflectionProblem,
  type ReflectionProblem,
} from "@/games/reflection/problem/problem";
import {
  countReflectionBoardPieces,
  createEmptyReflectionBoard,
  createEmptyReflectionInventory,
  type ReflectionBoard,
  type ReflectionCell,
  type ReflectionInventory,
  type ReflectionPiece,
  reflectionPieces,
} from "@/games/reflection/puzzle/board";
import {
  isSameReflectionEntry,
  type ReflectionEntry,
} from "@/games/reflection/puzzle/laser";
import { isReflectionSolved } from "@/games/reflection/puzzle/rules";
import { type GameSession, getClearedSessionElapsedMs } from "@/games/session";

export type ReflectionSelection =
  | { type: "stock"; piece: ReflectionPiece }
  | { type: "cell"; cellIndex: number };

export type ReflectionSession = GameSession<
  ReflectionProblem,
  ReflectionBoard
> & {
  selection: ReflectionSelection | null;
  /** 盤面・ストックを押して状態が変わった回数。 */
  inputCount: number;
  relocationCount: number;
  restartCount: number;
  laserEntry: ReflectionEntry | null;
  laserCheckCount: number;
};

export type ReflectionSessionResult = {
  elapsedMs: number;
  relocationCount: number;
  restartCount: number;
  laserCheckCount: number;
  inputCount: number;
};

export function createReflectionSession(
  problem: ReflectionProblem,
  startedAt: number,
): ReflectionSession {
  assertReflectionProblem(problem);

  return {
    status: "playing",
    problem,
    puzzleState: createEmptyReflectionBoard(problem.size),
    selection: null,
    startedAt,
    clearedAt: null,
    inputCount: 0,
    relocationCount: 0,
    restartCount: 0,
    laserEntry: null,
    laserCheckCount: 0,
  };
}

export function getReflectionSessionStock(
  session: ReflectionSession,
): ReflectionInventory {
  const placed = countReflectionBoardPieces(session.puzzleState);
  const stock = createEmptyReflectionInventory();
  for (const piece of reflectionPieces) {
    stock[piece] = session.problem.inventory[piece] - placed[piece];
  }
  return stock;
}

function isSameSelection(
  left: ReflectionSelection | null,
  right: ReflectionSelection | null,
): boolean {
  if (left === null || right === null) return left === right;
  if (left.type === "stock" && right.type === "stock") {
    return left.piece === right.piece;
  }
  if (left.type === "cell" && right.type === "cell") {
    return left.cellIndex === right.cellIndex;
  }
  return false;
}

function changeSelection(
  session: ReflectionSession,
  selection: ReflectionSelection | null,
): ReflectionSession {
  if (isSameSelection(session.selection, selection)) return session;

  return { ...session, selection, inputCount: session.inputCount + 1 };
}

function withCell(
  board: ReflectionBoard,
  cellIndex: number,
  cell: ReflectionCell,
): ReflectionBoard {
  const cells = [...board.cells];
  cells[cellIndex] = cell;
  return { ...board, cells };
}

function applyBoardChange(
  session: ReflectionSession,
  board: ReflectionBoard,
  selection: ReflectionSelection | null,
  relocated: boolean,
  operatedAt: number,
): ReflectionSession {
  const next: ReflectionSession = {
    ...session,
    puzzleState: board,
    selection,
    inputCount: session.inputCount + 1,
    relocationCount: session.relocationCount + (relocated ? 1 : 0),
    laserEntry: null,
  };

  if (!isReflectionSolved(board, session.problem)) return next;

  return {
    ...next,
    status: "cleared",
    selection: null,
    clearedAt: operatedAt,
  };
}

/** 置いた後も同じ種類が手持ちに残っていれば、続けて置けるよう選択を保つ。 */
function selectionAfterPlacing(
  session: ReflectionSession,
  board: ReflectionBoard,
  piece: ReflectionPiece,
): ReflectionSelection | null {
  const remaining = getReflectionSessionStock({
    ...session,
    puzzleState: board,
  })[piece];
  return remaining > 0 ? { type: "stock", piece } : null;
}

export function tapReflectionSessionStock(
  session: ReflectionSession,
  piece: ReflectionPiece,
  operatedAt: number,
): ReflectionSession {
  if (session.status !== "playing") return session;

  const { selection } = session;
  if (selection?.type === "cell") {
    const selectedCell = session.puzzleState.cells[selection.cellIndex] ?? null;
    if (
      selectedCell !== piece &&
      getReflectionSessionStock(session)[piece] <= 0
    ) {
      return session;
    }
    return applyBoardChange(
      session,
      withCell(
        session.puzzleState,
        selection.cellIndex,
        selectedCell === piece ? null : piece,
      ),
      null,
      true,
      operatedAt,
    );
  }

  if (selection?.type === "stock" && selection.piece === piece) {
    return changeSelection(session, null);
  }
  if (getReflectionSessionStock(session)[piece] <= 0) return session;

  return changeSelection(session, { type: "stock", piece });
}

export function tapReflectionSessionCell(
  session: ReflectionSession,
  cellIndex: number,
  operatedAt: number,
): ReflectionSession {
  if (session.status !== "playing") return session;

  const { puzzleState: board, selection } = session;
  const tappedCell = board.cells[cellIndex];
  if (tappedCell === undefined) return session;

  if (selection?.type === "stock") {
    // 置き換えは、盤面のピースを選んでからストックの種類を押して行う。
    if (tappedCell !== null) {
      return changeSelection(session, { type: "cell", cellIndex });
    }

    const nextBoard = withCell(board, cellIndex, selection.piece);
    return applyBoardChange(
      session,
      nextBoard,
      selectionAfterPlacing(session, nextBoard, selection.piece),
      false,
      operatedAt,
    );
  }

  if (selection?.type === "cell") {
    if (selection.cellIndex === cellIndex) {
      return changeSelection(session, null);
    }

    const selectedCell = board.cells[selection.cellIndex] ?? null;
    if (tappedCell === selectedCell) {
      // 同じ種類同士を入れ替えても盤面は変わらないので、押したマスを選び直す。
      return changeSelection(session, { type: "cell", cellIndex });
    }

    const nextBoard = withCell(
      withCell(board, cellIndex, selectedCell),
      selection.cellIndex,
      tappedCell,
    );
    return applyBoardChange(session, nextBoard, null, true, operatedAt);
  }

  if (tappedCell === null) return session;
  return changeSelection(session, { type: "cell", cellIndex });
}

export function removeReflectionSessionPiece(
  session: ReflectionSession,
  cellIndex: number,
  operatedAt: number,
): ReflectionSession {
  if (session.status !== "playing") return session;

  const cell = session.puzzleState.cells[cellIndex];
  if (cell === undefined || cell === null) return session;

  const { selection } = session;
  return applyBoardChange(
    session,
    withCell(session.puzzleState, cellIndex, null),
    selection?.type === "cell" ? null : selection,
    true,
    operatedAt,
  );
}

export function clearReflectionSessionSelection(
  session: ReflectionSession,
): ReflectionSession {
  if (session.status !== "playing") return session;

  return changeSelection(session, null);
}

export function tapReflectionSessionClue(
  session: ReflectionSession,
  entry: ReflectionEntry,
): ReflectionSession {
  if (session.status !== "playing") return session;

  if (session.laserEntry && isSameReflectionEntry(session.laserEntry, entry)) {
    return { ...session, laserEntry: null };
  }

  return {
    ...session,
    laserEntry: entry,
    laserCheckCount: session.laserCheckCount + 1,
  };
}

export function restartReflectionSession(
  session: ReflectionSession,
): ReflectionSession {
  if (!canRestartReflectionSession(session)) return session;

  return {
    ...session,
    puzzleState: createEmptyReflectionBoard(session.problem.size),
    selection: null,
    laserEntry: null,
    restartCount: session.restartCount + 1,
  };
}

export function canRestartReflectionSession(
  session: ReflectionSession,
): boolean {
  return (
    session.status === "playing" &&
    session.puzzleState.cells.some((cell) => cell !== null)
  );
}

export function getReflectionSessionResult(
  session: ReflectionSession,
): ReflectionSessionResult | null {
  const elapsedMs = getClearedSessionElapsedMs(session);
  if (elapsedMs === null) {
    return null;
  }

  return {
    elapsedMs,
    relocationCount: session.relocationCount,
    restartCount: session.restartCount,
    laserCheckCount: session.laserCheckCount,
    inputCount: session.inputCount,
  };
}
