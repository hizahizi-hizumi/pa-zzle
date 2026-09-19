import { assertNanpureProblem, type NanpureProblem } from "../problem/problem";
import {
  assertNanpureCellIndex,
  NANPURE_DIGITS,
  NANPURE_SIZE,
  type NanpureBoard,
  type NanpureDigit,
} from "../puzzle/board";
import { isNanpureSolved } from "../puzzle/rules";
import {
  clearNanpureCellNotes,
  clearNanpureNotesForCorrectEntry,
  createEmptyNanpureNotes,
  type NanpureNotes,
  toggleNanpureNoteDigit,
} from "./notes";

export type { NanpureNotes } from "./notes";

export type NanpureSessionStatus = "playing" | "cleared";

type NanpureSessionSnapshot = {
  board: NanpureBoard;
  notes: NanpureNotes;
};

export type NanpureSession = {
  status: NanpureSessionStatus;
  problem: NanpureProblem;
  board: NanpureBoard;
  notes: NanpureNotes;
  history: readonly NanpureSessionSnapshot[];
  startedAt: number;
  finishedAt: number | null;
  mistakeCount: number;
  undoCount: number;
  restartCount: number;
};

export type NanpureSessionResult = {
  elapsedMs: number;
  mistakeCount: number;
  undoCount: number;
  restartCount: number;
};

function isEditableCell(session: NanpureSession, cellIndex: number): boolean {
  return session.problem.clues[cellIndex] === null;
}

function withHistory(
  session: NanpureSession,
  board: NanpureBoard,
  notes: NanpureNotes,
): Pick<NanpureSession, "board" | "notes" | "history"> {
  return {
    board,
    notes,
    history: [
      ...session.history,
      { board: session.board, notes: session.notes },
    ],
  };
}

export function createNanpureSession(
  problem: NanpureProblem,
  startedAt: number,
): NanpureSession {
  assertNanpureProblem(problem);

  return {
    status: "playing",
    problem,
    board: [...problem.clues],
    notes: createEmptyNanpureNotes(),
    history: [],
    startedAt,
    finishedAt: null,
    mistakeCount: 0,
    undoCount: 0,
    restartCount: 0,
  };
}

export function enterNanpureDigit(
  session: NanpureSession,
  cellIndex: number,
  digit: NanpureDigit,
  enteredAt: number,
): NanpureSession {
  assertNanpureCellIndex(cellIndex);

  if (
    session.status !== "playing" ||
    !isEditableCell(session, cellIndex) ||
    session.board[cellIndex] === digit
  ) {
    return session;
  }

  const board = [...session.board];
  board[cellIndex] = digit;
  const isCorrect = session.problem.solution[cellIndex] === digit;
  const notes = isCorrect
    ? clearNanpureNotesForCorrectEntry(session.notes, cellIndex, digit)
    : clearNanpureCellNotes(session.notes, cellIndex);
  const cleared = isNanpureSolved(board);

  return {
    ...session,
    ...withHistory(session, board, notes),
    status: cleared ? "cleared" : "playing",
    finishedAt: cleared ? enteredAt : null,
    mistakeCount: session.mistakeCount + (isCorrect ? 0 : 1),
  };
}

export function clearNanpureCell(
  session: NanpureSession,
  cellIndex: number,
): NanpureSession {
  assertNanpureCellIndex(cellIndex);

  if (session.status !== "playing" || !isEditableCell(session, cellIndex)) {
    return session;
  }

  const cellNotes = session.notes[cellIndex] ?? [];
  if (session.board[cellIndex] === null && cellNotes.length === 0) {
    return session;
  }

  const board = [...session.board];
  board[cellIndex] = null;
  const notes = clearNanpureCellNotes(session.notes, cellIndex);

  return {
    ...session,
    ...withHistory(session, board, notes),
  };
}

export function toggleNanpureNote(
  session: NanpureSession,
  cellIndex: number,
  digit: NanpureDigit,
): NanpureSession {
  assertNanpureCellIndex(cellIndex);

  if (
    session.status !== "playing" ||
    !isEditableCell(session, cellIndex) ||
    session.board[cellIndex] !== null
  ) {
    return session;
  }

  const notes = toggleNanpureNoteDigit(session.notes, cellIndex, digit);

  return {
    ...session,
    ...withHistory(session, session.board, notes),
  };
}

export function undoNanpureSession(session: NanpureSession): NanpureSession {
  if (session.status !== "playing") {
    return session;
  }

  const previous = session.history.at(-1);
  if (!previous) {
    return session;
  }

  return {
    ...session,
    board: previous.board,
    notes: previous.notes,
    history: session.history.slice(0, -1),
    undoCount: session.undoCount + 1,
  };
}

export function restartNanpureSession(session: NanpureSession): NanpureSession {
  if (session.status !== "playing") {
    return session;
  }

  return {
    ...session,
    board: [...session.problem.clues],
    notes: createEmptyNanpureNotes(),
    history: [],
    restartCount: session.restartCount + 1,
  };
}

export function findNanpureMistakeCellIndices(
  session: NanpureSession,
): number[] {
  return session.board.flatMap((cell, cellIndex) =>
    cell !== null && cell !== session.problem.solution[cellIndex]
      ? [cellIndex]
      : [],
  );
}

export function findCompletedNanpureDigits(
  session: NanpureSession,
): NanpureDigit[] {
  return NANPURE_DIGITS.filter(
    (digit) =>
      session.board.filter(
        (cell, cellIndex) =>
          cell === digit && session.problem.solution[cellIndex] === digit,
      ).length === NANPURE_SIZE,
  );
}

export function canUndoNanpureSession(session: NanpureSession): boolean {
  return session.status === "playing" && session.history.length > 0;
}

export function getNanpureSessionElapsedMs(
  session: NanpureSession,
  now: number,
): number {
  return Math.max(0, (session.finishedAt ?? now) - session.startedAt);
}

export function getNanpureSessionResult(
  session: NanpureSession,
  now: number,
): NanpureSessionResult | null {
  if (session.status !== "cleared") {
    return null;
  }

  return {
    elapsedMs: getNanpureSessionElapsedMs(session, now),
    mistakeCount: session.mistakeCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  };
}
