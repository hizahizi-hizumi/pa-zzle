import { isSudokuSolved } from "./rules";
import {
  assertSudokuBoard,
  assertSudokuCellIndex,
  SUDOKU_CELL_COUNT,
  type SudokuBoard,
  type SudokuDigit,
  type SudokuProblem,
} from "./state";

export type SudokuSessionStatus = "playing" | "cleared";
export type SudokuNotes = readonly (readonly SudokuDigit[])[];

type SudokuSessionSnapshot = {
  board: SudokuBoard;
  notes: SudokuNotes;
};

export type SudokuSession = {
  status: SudokuSessionStatus;
  problem: SudokuProblem;
  board: SudokuBoard;
  notes: SudokuNotes;
  history: readonly SudokuSessionSnapshot[];
  startedAt: number;
  finishedAt: number | null;
  mistakeCount: number;
  undoCount: number;
  restartCount: number;
};

export type SudokuSessionResult = {
  elapsedMs: number;
  mistakeCount: number;
  undoCount: number;
  restartCount: number;
};

function createEmptyNotes(): SudokuNotes {
  return Array.from({ length: SUDOKU_CELL_COUNT }, () => []);
}

function validateProblem(problem: SudokuProblem): void {
  assertSudokuBoard(problem.clues);
  assertSudokuBoard(problem.solution);

  if (!isSudokuSolved(problem.solution)) {
    throw new Error("Sudoku problem solution must be a solved board");
  }

  const cluesMatchSolution = problem.clues.every(
    (cell, cellIndex) => cell === null || cell === problem.solution[cellIndex],
  );
  if (!cluesMatchSolution) {
    throw new Error("Sudoku problem clues must match its solution");
  }
}

function isEditableCell(session: SudokuSession, cellIndex: number): boolean {
  return session.problem.clues[cellIndex] === null;
}

function withHistory(
  session: SudokuSession,
  board: SudokuBoard,
  notes: SudokuNotes,
): Pick<SudokuSession, "board" | "notes" | "history"> {
  return {
    board,
    notes,
    history: [
      ...session.history,
      { board: session.board, notes: session.notes },
    ],
  };
}

export function createSudokuSession(
  problem: SudokuProblem,
  startedAt: number,
): SudokuSession {
  validateProblem(problem);

  return {
    status: "playing",
    problem,
    board: [...problem.clues],
    notes: createEmptyNotes(),
    history: [],
    startedAt,
    finishedAt: null,
    mistakeCount: 0,
    undoCount: 0,
    restartCount: 0,
  };
}

export function enterSudokuDigit(
  session: SudokuSession,
  cellIndex: number,
  digit: SudokuDigit,
  enteredAt: number,
): SudokuSession {
  assertSudokuCellIndex(cellIndex);

  if (
    session.status !== "playing" ||
    !isEditableCell(session, cellIndex) ||
    session.board[cellIndex] === digit
  ) {
    return session;
  }

  const board = [...session.board];
  board[cellIndex] = digit;
  const notes = session.notes.map((cellNotes, index) =>
    index === cellIndex && cellNotes.length > 0 ? [] : cellNotes,
  );
  const cleared = isSudokuSolved(board);

  return {
    ...session,
    ...withHistory(session, board, notes),
    status: cleared ? "cleared" : "playing",
    finishedAt: cleared ? enteredAt : null,
    mistakeCount:
      session.mistakeCount +
      (session.problem.solution[cellIndex] === digit ? 0 : 1),
  };
}

export function eraseSudokuDigit(
  session: SudokuSession,
  cellIndex: number,
): SudokuSession {
  assertSudokuCellIndex(cellIndex);

  if (
    session.status !== "playing" ||
    !isEditableCell(session, cellIndex) ||
    session.board[cellIndex] === null
  ) {
    return session;
  }

  const board = [...session.board];
  board[cellIndex] = null;

  return {
    ...session,
    ...withHistory(session, board, session.notes),
  };
}

export function toggleSudokuNote(
  session: SudokuSession,
  cellIndex: number,
  digit: SudokuDigit,
): SudokuSession {
  assertSudokuCellIndex(cellIndex);

  if (
    session.status !== "playing" ||
    !isEditableCell(session, cellIndex) ||
    session.board[cellIndex] !== null
  ) {
    return session;
  }

  const currentNotes = session.notes[cellIndex] ?? [];
  const nextCellNotes = currentNotes.includes(digit)
    ? currentNotes.filter((note) => note !== digit)
    : [...currentNotes, digit].sort((left, right) => left - right);
  const notes = session.notes.map((cellNotes, index) =>
    index === cellIndex ? nextCellNotes : cellNotes,
  );

  return {
    ...session,
    ...withHistory(session, session.board, notes),
  };
}

export function undoSudokuSession(session: SudokuSession): SudokuSession {
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

export function restartSudokuSession(session: SudokuSession): SudokuSession {
  if (session.status !== "playing") {
    return session;
  }

  return {
    ...session,
    board: [...session.problem.clues],
    notes: createEmptyNotes(),
    history: [],
    restartCount: session.restartCount + 1,
  };
}

export function canUndoSudokuSession(session: SudokuSession): boolean {
  return session.status === "playing" && session.history.length > 0;
}

export function getSudokuSessionElapsedMs(
  session: SudokuSession,
  now: number,
): number {
  return Math.max(0, (session.finishedAt ?? now) - session.startedAt);
}

export function getSudokuSessionResult(
  session: SudokuSession,
  now: number,
): SudokuSessionResult | null {
  if (session.status !== "cleared") {
    return null;
  }

  return {
    elapsedMs: getSudokuSessionElapsedMs(session, now),
    mistakeCount: session.mistakeCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  };
}
