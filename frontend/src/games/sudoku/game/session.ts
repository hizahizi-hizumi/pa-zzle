import {
  clearSudokuCellNotes,
  clearSudokuNotesForCorrectEntry,
  createEmptySudokuNotes,
  type SudokuNotes,
  toggleSudokuNoteDigit,
} from "./notes";
import { isSudokuSolved } from "./rules";
import {
  assertSudokuBoard,
  assertSudokuCellIndex,
  SUDOKU_DIGITS,
  SUDOKU_SIZE,
  type SudokuBoard,
  type SudokuDigit,
  type SudokuProblem,
} from "./state";

export type { SudokuNotes } from "./notes";

export type SudokuSessionStatus = "playing" | "cleared";

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
    notes: createEmptySudokuNotes(),
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
  const isCorrect = session.problem.solution[cellIndex] === digit;
  const notes = isCorrect
    ? clearSudokuNotesForCorrectEntry(session.notes, cellIndex, digit)
    : clearSudokuCellNotes(session.notes, cellIndex);
  const cleared = isSudokuSolved(board);

  return {
    ...session,
    ...withHistory(session, board, notes),
    status: cleared ? "cleared" : "playing",
    finishedAt: cleared ? enteredAt : null,
    mistakeCount: session.mistakeCount + (isCorrect ? 0 : 1),
  };
}

export function clearSudokuCell(
  session: SudokuSession,
  cellIndex: number,
): SudokuSession {
  assertSudokuCellIndex(cellIndex);

  if (session.status !== "playing" || !isEditableCell(session, cellIndex)) {
    return session;
  }

  const cellNotes = session.notes[cellIndex] ?? [];
  if (session.board[cellIndex] === null && cellNotes.length === 0) {
    return session;
  }

  const board = [...session.board];
  board[cellIndex] = null;
  const notes = clearSudokuCellNotes(session.notes, cellIndex);

  return {
    ...session,
    ...withHistory(session, board, notes),
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

  const notes = toggleSudokuNoteDigit(session.notes, cellIndex, digit);

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
    notes: createEmptySudokuNotes(),
    history: [],
    restartCount: session.restartCount + 1,
  };
}

export function findSudokuMistakeCellIndices(session: SudokuSession): number[] {
  return session.board.flatMap((cell, cellIndex) =>
    cell !== null && cell !== session.problem.solution[cellIndex]
      ? [cellIndex]
      : [],
  );
}

export function findCompletedSudokuDigits(
  session: SudokuSession,
): SudokuDigit[] {
  return SUDOKU_DIGITS.filter(
    (digit) =>
      session.board.filter(
        (cell, cellIndex) =>
          cell === digit && session.problem.solution[cellIndex] === digit,
      ).length === SUDOKU_SIZE,
  );
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
