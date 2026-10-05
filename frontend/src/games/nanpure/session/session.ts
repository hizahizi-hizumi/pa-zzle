import {
  assertNanpureProblem,
  type NanpureProblem,
} from "@/games/nanpure/problem/problem";
import {
  assertNanpureCellIndex,
  NANPURE_DIGITS,
  NANPURE_SIZE,
  type NanpureBoard,
  type NanpureDigit,
} from "@/games/nanpure/puzzle/board";
import { isNanpureSolved } from "@/games/nanpure/puzzle/rules";
import {
  clearNanpureCellNotes,
  clearNanpureNotesForCorrectEntry,
  createEmptyNanpureNotes,
  type NanpureNotes,
  toggleNanpureNoteDigit,
} from "@/games/nanpure/session/notes";
import { type GameSession, getClearedSessionElapsedMs } from "@/games/session";

export type { NanpureNotes } from "@/games/nanpure/session/notes";

type NanpureSessionSnapshot = {
  puzzleState: NanpureBoard;
  notes: NanpureNotes;
};

export type NanpureSession = GameSession<NanpureProblem, NanpureBoard> & {
  notes: NanpureNotes;
  history: readonly NanpureSessionSnapshot[];
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
  puzzleState: NanpureBoard,
  notes: NanpureNotes,
): Pick<NanpureSession, "puzzleState" | "notes" | "history"> {
  return {
    puzzleState,
    notes,
    history: [
      ...session.history,
      { puzzleState: session.puzzleState, notes: session.notes },
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
    puzzleState: [...problem.clues],
    notes: createEmptyNanpureNotes(),
    history: [],
    startedAt,
    finishedAt: null,
    mistakeCount: 0,
    undoCount: 0,
    restartCount: 0,
  };
}

export function enterNanpureSessionDigit(
  session: NanpureSession,
  cellIndex: number,
  digit: NanpureDigit,
  enteredAt: number,
): NanpureSession {
  assertNanpureCellIndex(cellIndex);

  if (
    session.status !== "playing" ||
    !isEditableCell(session, cellIndex) ||
    session.puzzleState[cellIndex] === digit
  ) {
    return session;
  }

  const board = [...session.puzzleState];
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

export function clearNanpureSessionCell(
  session: NanpureSession,
  cellIndex: number,
): NanpureSession {
  assertNanpureCellIndex(cellIndex);

  if (session.status !== "playing" || !isEditableCell(session, cellIndex)) {
    return session;
  }

  const cellNotes = session.notes[cellIndex] ?? [];
  if (session.puzzleState[cellIndex] === null && cellNotes.length === 0) {
    return session;
  }

  const board = [...session.puzzleState];
  board[cellIndex] = null;
  const notes = clearNanpureCellNotes(session.notes, cellIndex);

  return {
    ...session,
    ...withHistory(session, board, notes),
  };
}

export function toggleNanpureSessionNote(
  session: NanpureSession,
  cellIndex: number,
  digit: NanpureDigit,
): NanpureSession {
  assertNanpureCellIndex(cellIndex);

  if (
    session.status !== "playing" ||
    !isEditableCell(session, cellIndex) ||
    session.puzzleState[cellIndex] !== null
  ) {
    return session;
  }

  const notes = toggleNanpureNoteDigit(session.notes, cellIndex, digit);

  return {
    ...session,
    ...withHistory(session, session.puzzleState, notes),
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
    puzzleState: previous.puzzleState,
    notes: previous.notes,
    history: session.history.slice(0, -1),
    undoCount: session.undoCount + 1,
  };
}

/** 同じプレイのまま盤面を初期状態へ戻す（盤面を戻す）。経過時間と記録は引き継ぐ。 */
export function restartNanpureSession(session: NanpureSession): NanpureSession {
  if (!canRestartNanpureSession(session)) {
    return session;
  }

  return {
    ...session,
    puzzleState: [...session.problem.clues],
    notes: createEmptyNanpureNotes(),
    history: [],
    restartCount: session.restartCount + 1,
  };
}

export function findNanpureSessionMistakeCellIndices(
  session: NanpureSession,
): number[] {
  return session.puzzleState.flatMap((cell, cellIndex) =>
    cell !== null && cell !== session.problem.solution[cellIndex]
      ? [cellIndex]
      : [],
  );
}

export function findNanpureSessionCompletedDigits(
  session: NanpureSession,
): NanpureDigit[] {
  return NANPURE_DIGITS.filter(
    (digit) =>
      session.puzzleState.filter(
        (cell, cellIndex) =>
          cell === digit && session.problem.solution[cellIndex] === digit,
      ).length === NANPURE_SIZE,
  );
}

export function canUndoNanpureSession(session: NanpureSession): boolean {
  return session.status === "playing" && session.history.length > 0;
}

/** 盤面に数字かメモがあるプレイ中だけ、盤面を戻せる。 */
export function canRestartNanpureSession(session: NanpureSession): boolean {
  return (
    session.status === "playing" &&
    (session.puzzleState.some(
      (cell, cellIndex) => cell !== session.problem.clues[cellIndex],
    ) ||
      session.notes.some((cellNotes) => cellNotes.length > 0))
  );
}

export function getNanpureSessionResult(
  session: NanpureSession,
): NanpureSessionResult | null {
  const elapsedMs = getClearedSessionElapsedMs(session);
  if (elapsedMs === null) {
    return null;
  }

  return {
    elapsedMs,
    mistakeCount: session.mistakeCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  };
}
