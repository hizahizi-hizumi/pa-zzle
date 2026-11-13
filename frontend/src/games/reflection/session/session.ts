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

  const puzzleState = createEmptyReflectionBoard(problem.size);
  return {
    status: "playing",
    problem,
    puzzleState,
    selection: selectRemainingStockPiece(problem, puzzleState, null),
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
  return countRemainingPieces(session.problem, session.puzzleState);
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

function countRemainingPieces(
  problem: ReflectionProblem,
  board: ReflectionBoard,
): ReflectionInventory {
  const placed = countReflectionBoardPieces(board);
  const stock = createEmptyReflectionInventory();
  for (const piece of reflectionPieces) {
    stock[piece] = problem.inventory[piece] - placed[piece];
  }
  return stock;
}

/**
 * 次に置く種類を、手持ちに残っている種類から選んでおく。空きマスを押せば、いつも置ける状態にするため。
 * `preferred` が残っていればそれを、使い切っていればストックの並びでその次に残っている種類を選ぶ。
 * 手持ちを置き切っていれば何も選ばない。
 */
function selectRemainingStockPiece(
  problem: ReflectionProblem,
  board: ReflectionBoard,
  preferred: ReflectionPiece | null,
): ReflectionSelection | null {
  const stock = countRemainingPieces(problem, board);
  const start = preferred === null ? 0 : reflectionPieces.indexOf(preferred);
  for (let offset = 0; offset < reflectionPieces.length; offset += 1) {
    const piece =
      reflectionPieces[(start + offset) % reflectionPieces.length] ?? null;
    if (piece !== null && stock[piece] > 0) {
      return { type: "stock", piece };
    }
  }
  return null;
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
    const nextBoard = withCell(
      session.puzzleState,
      selection.cellIndex,
      selectedCell === piece ? null : piece,
    );
    return applyBoardChange(
      session,
      nextBoard,
      selectRemainingStockPiece(
        session.problem,
        nextBoard,
        selectedCell ?? piece,
      ),
      true,
      operatedAt,
    );
  }

  // 選んでいる種類を押し直しても選んだままにする。何も選んでいない状態に戻すと、空きマスを押しても何も起きなくなる。
  if (selection?.type === "stock" && selection.piece === piece) {
    return session;
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
      selectRemainingStockPiece(session.problem, nextBoard, selection.piece),
      false,
      operatedAt,
    );
  }

  if (selection?.type === "cell") {
    if (selection.cellIndex === cellIndex) {
      return changeSelection(
        session,
        selectRemainingStockPiece(
          session.problem,
          board,
          board.cells[cellIndex] ?? null,
        ),
      );
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
    return applyBoardChange(
      session,
      nextBoard,
      selectRemainingStockPiece(session.problem, nextBoard, selectedCell),
      true,
      operatedAt,
    );
  }

  // 手持ちを置き切ると何も選んでいない。空きマスには置く物が無い。
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
  const nextBoard = withCell(session.puzzleState, cellIndex, null);
  return applyBoardChange(
    session,
    nextBoard,
    selection?.type === "stock"
      ? selection
      : selectRemainingStockPiece(session.problem, nextBoard, cell),
    true,
    operatedAt,
  );
}

/** 盤面のピースの選択を解き、次に置く種類の選択へ戻す。ストックの種類を選んでいるときは、選んだままにする。 */
export function clearReflectionSessionSelection(
  session: ReflectionSession,
): ReflectionSession {
  if (session.status !== "playing") return session;
  if (session.selection?.type !== "cell") return session;

  const { cellIndex } = session.selection;
  return changeSelection(
    session,
    selectRemainingStockPiece(
      session.problem,
      session.puzzleState,
      session.puzzleState.cells[cellIndex] ?? null,
    ),
  );
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

  const emptyBoard = createEmptyReflectionBoard(session.problem.size);
  return {
    ...session,
    puzzleState: emptyBoard,
    selection: selectRemainingStockPiece(session.problem, emptyBoard, null),
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
