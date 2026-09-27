import {
  assertTakuzuProblem,
  type TakuzuProblem,
} from "@/games/takuzu/problem/problem";
import type { TakuzuBoard, TakuzuCell } from "@/games/takuzu/puzzle/board";
import {
  findTakuzuRuleViolations,
  isTakuzuSolved,
  listTakuzuViolatedCellIndices,
} from "@/games/takuzu/puzzle/rules";
import {
  cycleTakuzuCell,
  isTakuzuGivenCell,
  type TakuzuCycleDirection,
} from "@/games/takuzu/puzzle/transitions";

export type TakuzuSessionStatus = "playing" | "cleared";

/**
 * 同じマスを続けて押している間の記録。
 * 別のマスを押すまでは1回の入力とみなし、押し始める前の値と比べて置き直しかどうかを決める。
 */
type TakuzuEditingCell = {
  cellIndex: number;
  cellBeforeEditing: TakuzuCell;
};

/** 待ったで戻す先。盤面と、その盤面までの置き直しの記録を一緒に戻す。 */
type TakuzuSessionSnapshot = {
  board: TakuzuBoard;
  settledCorrectionCount: number;
  editingCell: TakuzuEditingCell | null;
};

export type TakuzuSession = {
  status: TakuzuSessionStatus;
  problem: TakuzuProblem;
  board: TakuzuBoard;
  startedAt: number;
  finishedAt: number | null;
  /** 固定マス以外のマスを押した回数。 */
  inputCount: number;
  /** 盤面を戻した回数。 */
  restartCount: number;
  /** 待ったで盤面操作を取り消した回数。 */
  undoCount: number;
  /** 待ったで戻せる盤面操作の履歴。古い順。盤面を戻すと空にする。 */
  history: readonly TakuzuSessionSnapshot[];
  /** 押し終えたマスで確定した置き直しの回数。押している途中のマスは `editingCell` から数える。 */
  settledCorrectionCount: number;
  editingCell: TakuzuEditingCell | null;
};

/** 評価に使うプレイ事実。採点はしない。 */
export type TakuzuSessionResult = {
  elapsedMs: number;
  correctionCount: number;
  restartCount: number;
  undoCount: number;
  inputCount: number;
};

export type TakuzuCellView = {
  cell: TakuzuCell;
  given: boolean;
  violated: boolean;
};

function isCorrection(
  board: TakuzuBoard,
  editingCell: TakuzuEditingCell | null,
): boolean {
  if (!editingCell || editingCell.cellBeforeEditing === null) {
    return false;
  }
  return board.cells[editingCell.cellIndex] !== editingCell.cellBeforeEditing;
}

function takeSnapshot(session: TakuzuSession): TakuzuSessionSnapshot {
  return {
    board: session.board,
    settledCorrectionCount: session.settledCorrectionCount,
    editingCell: session.editingCell,
  };
}

function settleEditingCell(session: TakuzuSession): TakuzuSession {
  return {
    ...session,
    settledCorrectionCount: getTakuzuSessionCorrectionCount(session),
    editingCell: null,
  };
}

export function createTakuzuSession(
  problem: TakuzuProblem,
  startedAt: number,
): TakuzuSession {
  assertTakuzuProblem(problem);

  return {
    status: "playing",
    problem,
    board: problem.givens,
    startedAt,
    finishedAt: null,
    inputCount: 0,
    restartCount: 0,
    undoCount: 0,
    history: [],
    settledCorrectionCount: 0,
    editingCell: null,
  };
}

export function cycleTakuzuSessionCell(
  session: TakuzuSession,
  cellIndex: number,
  direction: TakuzuCycleDirection,
  operatedAt: number,
): TakuzuSession {
  if (session.status !== "playing") {
    return session;
  }

  const board = cycleTakuzuCell(
    session.problem.givens,
    session.board,
    cellIndex,
    direction,
  );
  if (board === session.board) {
    return session;
  }

  const continuesEditing = session.editingCell?.cellIndex === cellIndex;
  const beforeInput = continuesEditing ? session : settleEditingCell(session);
  const next: TakuzuSession = {
    ...beforeInput,
    board,
    history: [...session.history, takeSnapshot(session)],
    inputCount: session.inputCount + 1,
    editingCell: beforeInput.editingCell ?? {
      cellIndex,
      cellBeforeEditing: session.board.cells[cellIndex] ?? null,
    },
  };

  if (!isTakuzuSolved(board)) {
    return next;
  }

  return {
    ...settleEditingCell(next),
    status: "cleared",
    finishedAt: operatedAt,
  };
}

/**
 * 同じプレイのまま盤面を初期配置へ戻す（盤面を戻す）。経過時間と入力の記録は引き継ぐ。
 * 盤面が初期配置のままなら何もしない。盤面を戻して消えたマスは置き直しに数えない。
 * 盤面を戻す前の操作は待ったで戻せない。
 */
export function restartTakuzuSession(session: TakuzuSession): TakuzuSession {
  if (session.status !== "playing") {
    return session;
  }

  const hasPlacedTile = session.board.cells.some(
    function differsFromGivens(cell, cellIndex) {
      return cell !== session.problem.givens.cells[cellIndex];
    },
  );
  if (!hasPlacedTile) {
    return session;
  }

  return {
    ...settleEditingCell(session),
    board: session.problem.givens,
    history: [],
    restartCount: session.restartCount + 1,
  };
}

/**
 * 直前の盤面操作を1つ取り消す（待った）。置き直しの記録も操作前へ戻すので、取り消した操作は置き直しに数えない。
 * 入力回数は押した事実として戻さない。
 */
export function undoTakuzuSession(session: TakuzuSession): TakuzuSession {
  if (session.status !== "playing") {
    return session;
  }

  const previous = session.history.at(-1);
  if (!previous) {
    return session;
  }

  return {
    ...session,
    ...previous,
    history: session.history.slice(0, -1),
    undoCount: session.undoCount + 1,
  };
}

export function canUndoTakuzuSession(session: TakuzuSession): boolean {
  return session.status === "playing" && session.history.length > 0;
}

/** 同じ問題を新しいプレイとして始める（やり直し）。 */
export function replayTakuzuSession(
  session: TakuzuSession,
  startedAt: number,
): TakuzuSession {
  return createTakuzuSession(session.problem, startedAt);
}

export function getTakuzuSessionCorrectionCount(
  session: TakuzuSession,
): number {
  return (
    session.settledCorrectionCount +
    (isCorrection(session.board, session.editingCell) ? 1 : 0)
  );
}

export function getTakuzuSessionElapsedMs(
  session: TakuzuSession,
  now: number,
): number {
  return Math.max(0, (session.finishedAt ?? now) - session.startedAt);
}

export function getTakuzuSessionResult(
  session: TakuzuSession,
): TakuzuSessionResult | null {
  if (session.status !== "cleared" || session.finishedAt === null) {
    return null;
  }

  return {
    elapsedMs: getTakuzuSessionElapsedMs(session, session.finishedAt),
    correctionCount: getTakuzuSessionCorrectionCount(session),
    restartCount: session.restartCount,
    undoCount: session.undoCount,
    inputCount: session.inputCount,
  };
}

export function getTakuzuSessionCellViews(
  session: TakuzuSession,
): TakuzuCellView[] {
  const { board, problem } = session;
  const violatedCellIndices = new Set(
    listTakuzuViolatedCellIndices(board.size, findTakuzuRuleViolations(board)),
  );

  return board.cells.map(function createCellView(cell, cellIndex) {
    return {
      cell,
      given: isTakuzuGivenCell(problem.givens, cellIndex),
      violated: violatedCellIndices.has(cellIndex),
    };
  });
}
