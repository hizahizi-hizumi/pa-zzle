import { type GameSession, getClearedSessionElapsedMs } from "@/games/session";
import {
  assertTakuzuProblem,
  type TakuzuProblem,
} from "@/games/takuzu/problem/problem";
import {
  listTakuzuLines,
  type TakuzuBoard,
  type TakuzuCell,
  type TakuzuLine,
} from "@/games/takuzu/puzzle/board";
import {
  findTakuzuRuleViolations,
  isTakuzuSolved,
} from "@/games/takuzu/puzzle/rules";
import {
  getNextTakuzuCell,
  isTakuzuGivenCell,
  placeTakuzuCell,
  type TakuzuCycleDirection,
} from "@/games/takuzu/puzzle/transitions";

/**
 * 同じマスを続けて押している間の記録。
 */
type TakuzuEditingCell = {
  cellIndex: number;
  cellBeforeEditing: TakuzuCell;
};

type TakuzuSessionSnapshot = {
  puzzleState: TakuzuBoard;
  settledCorrectionCount: number;
  editingCell: TakuzuEditingCell | null;
};

export type TakuzuSession = GameSession<TakuzuProblem, TakuzuBoard> & {
  /** 固定マス以外のマスを押した回数。 */
  inputCount: number;
  restartCount: number;
  undoCount: number;
  /** 待ったで戻せる盤面操作の履歴。古い順。 */
  history: readonly TakuzuSessionSnapshot[];
  /** 押し終えたマスで確定した置き直しの回数。押している途中のマスは `editingCell` から数える。 */
  settledCorrectionCount: number;
  editingCell: TakuzuEditingCell | null;
};

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
  inViolatingRun: boolean;
};

export type TakuzuLineViolationView = TakuzuLine & {
  overfilled: boolean;
  duplicated: boolean;
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
    puzzleState: session.puzzleState,
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
    puzzleState: problem.givens,
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

export function placeTakuzuSessionCell(
  session: TakuzuSession,
  cellIndex: number,
  cell: TakuzuCell,
  operatedAt: number,
): TakuzuSession {
  if (session.status !== "playing") {
    return session;
  }

  const board = placeTakuzuCell(
    session.problem.givens,
    session.puzzleState,
    cellIndex,
    cell,
  );
  if (board === session.puzzleState) {
    return session;
  }

  const continuesEditing = session.editingCell?.cellIndex === cellIndex;
  const beforeInput = continuesEditing ? session : settleEditingCell(session);
  const next: TakuzuSession = {
    ...beforeInput,
    puzzleState: board,
    history: [...session.history, takeSnapshot(session)],
    inputCount: session.inputCount + 1,
    editingCell: beforeInput.editingCell ?? {
      cellIndex,
      cellBeforeEditing: session.puzzleState.cells[cellIndex] ?? null,
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

export function cycleTakuzuSessionCell(
  session: TakuzuSession,
  cellIndex: number,
  direction: TakuzuCycleDirection,
  operatedAt: number,
): TakuzuSession {
  const cell = session.puzzleState.cells[cellIndex];
  if (cell === undefined) {
    return session;
  }

  return placeTakuzuSessionCell(
    session,
    cellIndex,
    getNextTakuzuCell(cell, direction),
    operatedAt,
  );
}

/**
 * 同じプレイのまま盤面を初期配置へ戻す（盤面を戻す）。経過時間と入力の記録は引き継ぐ。
 * 盤面を戻す前の操作は待ったで戻せない。
 */
export function restartTakuzuSession(session: TakuzuSession): TakuzuSession {
  if (!canRestartTakuzuSession(session)) {
    return session;
  }

  return {
    ...settleEditingCell(session),
    puzzleState: session.problem.givens,
    history: [],
    restartCount: session.restartCount + 1,
  };
}

export function canRestartTakuzuSession(session: TakuzuSession): boolean {
  return (
    session.status === "playing" &&
    session.puzzleState.cells.some(function differsFromGivens(cell, cellIndex) {
      return cell !== session.problem.givens.cells[cellIndex];
    })
  );
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

export function getTakuzuSessionCorrectionCount(
  session: TakuzuSession,
): number {
  return (
    session.settledCorrectionCount +
    (isCorrection(session.puzzleState, session.editingCell) ? 1 : 0)
  );
}

export function getTakuzuSessionResult(
  session: TakuzuSession,
): TakuzuSessionResult | null {
  const elapsedMs = getClearedSessionElapsedMs(session);
  if (elapsedMs === null) {
    return null;
  }

  return {
    elapsedMs,
    correctionCount: getTakuzuSessionCorrectionCount(session),
    restartCount: session.restartCount,
    undoCount: session.undoCount,
    inputCount: session.inputCount,
  };
}

export function getTakuzuSessionCellViews(
  session: TakuzuSession,
): TakuzuCellView[] {
  const { puzzleState: board, problem } = session;
  const runCellIndices = new Set(
    findTakuzuRuleViolations(board).runCellIndices,
  );

  return board.cells.map(function createCellView(cell, cellIndex) {
    return {
      cell,
      given: isTakuzuGivenCell(problem.givens, cellIndex),
      inViolatingRun: runCellIndices.has(cellIndex),
    };
  });
}

function isSameLine(left: TakuzuLine, right: TakuzuLine): boolean {
  return left.axis === right.axis && left.index === right.index;
}

/** 行（上から）、列（左から）の順に並べる。 */
export function getTakuzuSessionLineViolations(
  session: TakuzuSession,
): TakuzuLineViolationView[] {
  const { overfilledLines, duplicateLines } = findTakuzuRuleViolations(
    session.puzzleState,
  );

  return listTakuzuLines(session.puzzleState.size).flatMap(
    function createLineViolation(line) {
      const overfilled = overfilledLines.some((other) =>
        isSameLine(line, other),
      );
      const duplicated = duplicateLines.some((other) =>
        isSameLine(line, other),
      );
      return overfilled || duplicated
        ? [{ ...line, overfilled, duplicated }]
        : [];
    },
  );
}
