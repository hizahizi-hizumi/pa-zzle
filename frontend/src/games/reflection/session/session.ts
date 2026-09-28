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

export type ReflectionSessionStatus = "playing" | "cleared";

/**
 * 選んでいる対象。
 * - `stock`: 手持ちのピースの種類。空きマスを押すとその種類を置く。
 * - `cell`: 盤面に置いたピース。別のマスやストックを押すと動かす。
 */
export type ReflectionSelection =
  | { type: "stock"; piece: ReflectionPiece }
  | { type: "cell"; cellIndex: number };

export type ReflectionSession = {
  status: ReflectionSessionStatus;
  problem: ReflectionProblem;
  board: ReflectionBoard;
  selection: ReflectionSelection | null;
  startedAt: number;
  finishedAt: number | null;
  /** 盤面・ストックを押して状態が変わった回数。 */
  inputCount: number;
  /**
   * 一度盤面に置いたピースを動かし直した回数。
   * 別のマスへ移す・入れ替える・ストックへ戻す・別の種類で上書きされる・待ったで取り消される、をそれぞれ1回と数える。
   */
  relocationCount: number;
  /** 盤面を戻した回数。 */
  restartCount: number;
  /** 待ったで盤面操作を取り消した回数。 */
  undoCount: number;
  /**
   * 光路を表示している外周の位置。表示するのは今の盤面での光路で、盤面が変わると閉じる。
   */
  laserEntry: ReflectionEntry | null;
  /** 外周ヒントを押して光路を表示した回数。 */
  laserCheckCount: number;
  /** 待ったで戻せる盤面の履歴。古い順。盤面を戻すと空にする。 */
  history: readonly ReflectionBoard[];
};

/** 評価に使うプレイ事実。採点はしない。 */
export type ReflectionSessionResult = {
  elapsedMs: number;
  relocationCount: number;
  restartCount: number;
  undoCount: number;
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
    board: createEmptyReflectionBoard(problem.size),
    selection: null,
    startedAt,
    finishedAt: null,
    inputCount: 0,
    relocationCount: 0,
    restartCount: 0,
    undoCount: 0,
    laserEntry: null,
    laserCheckCount: 0,
    history: [],
  };
}

/** まだ盤面に置いていない手持ちのピース。 */
export function getReflectionSessionStock(
  session: ReflectionSession,
): ReflectionInventory {
  const placed = countReflectionBoardPieces(session.board);
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

/**
 * 盤面を変える操作を反映する。変える前の盤面を待ったの履歴へ積み、揃えばクリアにする。
 * `relocated` は、置いてあったピースを動かし直した操作か。
 * 表示中の光路は変える前の盤面のものなので閉じる。確かめ直すには外周ヒントを押し直す。
 */
function applyBoardChange(
  session: ReflectionSession,
  board: ReflectionBoard,
  selection: ReflectionSelection | null,
  relocated: boolean,
  operatedAt: number,
): ReflectionSession {
  const next: ReflectionSession = {
    ...session,
    board,
    selection,
    inputCount: session.inputCount + 1,
    relocationCount: session.relocationCount + (relocated ? 1 : 0),
    laserEntry: null,
    history: [...session.history, session.board],
  };

  if (!isReflectionSolved(board, session.problem)) return next;

  return {
    ...next,
    status: "cleared",
    selection: null,
    finishedAt: operatedAt,
  };
}

/** 置いた後も同じ種類が手持ちに残っていれば、続けて置けるよう選択を保つ。 */
function selectionAfterPlacing(
  session: ReflectionSession,
  board: ReflectionBoard,
  piece: ReflectionPiece,
): ReflectionSelection | null {
  const remaining = getReflectionSessionStock({ ...session, board })[piece];
  return remaining > 0 ? { type: "stock", piece } : null;
}

/**
 * ストックを押す。`piece` は押したピースの種類。
 * - 盤面のピースを選んでいれば、そのピースをストックへ戻す（どの種類を押しても同じ）。
 * - そうでなければ、その種類を選ぶ。選んでいる種類をもう一度押すと選択を解除する。残りが無い種類は選べない。
 */
export function tapReflectionSessionStock(
  session: ReflectionSession,
  piece: ReflectionPiece,
  operatedAt: number,
): ReflectionSession {
  if (session.status !== "playing") return session;

  const { selection } = session;
  if (selection?.type === "cell") {
    return applyBoardChange(
      session,
      withCell(session.board, selection.cellIndex, null),
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

/**
 * 盤面のマスを押す。
 * - ストックの種類を選んでいれば、空きマスへ置く。別の種類のピースがあるマスでは、そのピースをストックへ戻して置き直す。
 * - 盤面のピースを選んでいれば、空きマスへ移す、または別の種類のピースと入れ替える。同じマスを押すと選択を解除する。
 * - 何も選んでいなければ、ピースのあるマスを選ぶ。
 */
export function tapReflectionSessionCell(
  session: ReflectionSession,
  cellIndex: number,
  operatedAt: number,
): ReflectionSession {
  if (session.status !== "playing") return session;

  const { board, selection } = session;
  const tappedCell = board.cells[cellIndex];
  if (tappedCell === undefined) return session;

  if (selection?.type === "stock") {
    if (tappedCell === selection.piece) return session;

    const nextBoard = withCell(board, cellIndex, selection.piece);
    return applyBoardChange(
      session,
      nextBoard,
      selectionAfterPlacing(session, nextBoard, selection.piece),
      tappedCell !== null,
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

/**
 * 盤面のマスのピースをストックへ戻す（キーボードの Delete / Backspace）。
 * 盤面のピースを選んでからストックを押すのと同じく、置き直しに数える。空きマスでは何もしない。
 */
export function removeReflectionSessionPiece(
  session: ReflectionSession,
  cellIndex: number,
  operatedAt: number,
): ReflectionSession {
  if (session.status !== "playing") return session;

  const cell = session.board.cells[cellIndex];
  if (cell === undefined || cell === null) return session;

  const { selection } = session;
  return applyBoardChange(
    session,
    withCell(session.board, cellIndex, null),
    selection?.type === "cell" ? null : selection,
    true,
    operatedAt,
  );
}

/** 選択を解除する（キーボードの Escape）。 */
export function clearReflectionSessionSelection(
  session: ReflectionSession,
): ReflectionSession {
  if (session.status !== "playing") return session;

  return changeSelection(session, null);
}

/**
 * 外周ヒントを押す。その位置から入れた光の、今の盤面での光路を表示し、光路を確かめた回数を数える。
 * 表示中の位置をもう一度押すと閉じる（数えない）。盤面と選択は変えない。
 */
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

/**
 * 直前の盤面操作を1つ取り消す（待った）。
 * 取り消すと一度置いたピースが動くので、置き直しとして1回数える。置き直しの回数は操作前へ戻さない。
 */
export function undoReflectionSession(
  session: ReflectionSession,
): ReflectionSession {
  if (session.status !== "playing") return session;

  const previous = session.history.at(-1);
  if (!previous) return session;

  return {
    ...session,
    board: previous,
    selection: null,
    laserEntry: null,
    history: session.history.slice(0, -1),
    undoCount: session.undoCount + 1,
    relocationCount: session.relocationCount + 1,
  };
}

export function canUndoReflectionSession(session: ReflectionSession): boolean {
  return session.status === "playing" && session.history.length > 0;
}

/**
 * 同じプレイのまま、全ピースをストックへ戻す（盤面を戻す）。経過時間と記録は引き継ぐ。
 * 戻したピースは置き直しに数えない。盤面を戻す前の操作は待ったで戻せない。
 */
export function restartReflectionSession(
  session: ReflectionSession,
): ReflectionSession {
  if (!canRestartReflectionSession(session)) return session;

  return {
    ...session,
    board: createEmptyReflectionBoard(session.problem.size),
    selection: null,
    laserEntry: null,
    history: [],
    restartCount: session.restartCount + 1,
  };
}

export function canRestartReflectionSession(
  session: ReflectionSession,
): boolean {
  return (
    session.status === "playing" &&
    session.board.cells.some((cell) => cell !== null)
  );
}

/** 同じ問題を新しいプレイとして始める（やり直す）。 */
export function replayReflectionSession(
  session: ReflectionSession,
  startedAt: number,
): ReflectionSession {
  return createReflectionSession(session.problem, startedAt);
}

export function getReflectionSessionElapsedMs(
  session: ReflectionSession,
  now: number,
): number {
  return Math.max(0, (session.finishedAt ?? now) - session.startedAt);
}

export function getReflectionSessionResult(
  session: ReflectionSession,
): ReflectionSessionResult | null {
  if (session.status !== "cleared" || session.finishedAt === null) {
    return null;
  }

  return {
    elapsedMs: getReflectionSessionElapsedMs(session, session.finishedAt),
    relocationCount: session.relocationCount,
    restartCount: session.restartCount,
    undoCount: session.undoCount,
    laserCheckCount: session.laserCheckCount,
    inputCount: session.inputCount,
  };
}
