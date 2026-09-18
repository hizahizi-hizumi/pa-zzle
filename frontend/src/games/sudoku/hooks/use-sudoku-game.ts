import { useCallback, useEffect, useMemo, useState } from "react";

import { createSeed } from "@/games/core/seed";
import type { SudokuDifficulty } from "@/games/sudoku/game/difficulty";
import {
  generateSudokuProblem,
  type SudokuProblemIdentity,
} from "@/games/sudoku/game/generator";
import { findSudokuConflictCellIndices } from "@/games/sudoku/game/rules";
import {
  canUndoSudokuSession,
  clearSudokuCell,
  createSudokuSession,
  enterSudokuDigit,
  findSudokuMistakeCellIndices,
  getSudokuSessionElapsedMs,
  getSudokuSessionResult,
  restartSudokuSession,
  type SudokuSession,
  type SudokuSessionResult,
  toggleSudokuNote,
  undoSudokuSession,
} from "@/games/sudoku/game/session";
import type { SudokuDigit } from "@/games/sudoku/game/state";

const SUDOKU_BASELINE_CLUE_COUNT = 32;

export type SudokuProgress = "playing" | "clearing" | "result";

export type SudokuResult = SudokuSessionResult & {
  problemIdentity: SudokuProblemIdentity;
};

type SudokuReactState = {
  session: SudokuSession;
  problemIdentity: SudokuProblemIdentity;
  selectedCellIndex: number | null;
  notesMode: boolean;
  progress: SudokuProgress;
};

function createReactState(startedAt: number): SudokuReactState {
  const problem = generateSudokuProblem({
    seed: createSeed(),
    clueCount: SUDOKU_BASELINE_CLUE_COUNT,
  });

  return {
    session: createSudokuSession(problem, startedAt),
    problemIdentity: problem.identity,
    selectedCellIndex: null,
    notesMode: false,
    progress: "playing",
  };
}

export function useSudokuGame(difficulty: SudokuDifficulty) {
  const [play, setPlay] = useState<SudokuReactState>(() =>
    createReactState(Date.now()),
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (play.session.status !== "playing") {
      return;
    }

    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);

    return () => window.clearInterval(timer);
  }, [play.session.status]);

  const selectCell = useCallback((cellIndex: number) => {
    setPlay((current) => ({ ...current, selectedCellIndex: cellIndex }));
  }, []);

  const inputDigit = useCallback((digit: SudokuDigit) => {
    const enteredAt = Date.now();
    setNow(enteredAt);
    setPlay((current) => {
      const cellIndex = current.selectedCellIndex;
      if (cellIndex === null) {
        return current;
      }

      const session = current.notesMode
        ? toggleSudokuNote(current.session, cellIndex, digit)
        : enterSudokuDigit(current.session, cellIndex, digit, enteredAt);

      return session === current.session
        ? current
        : {
            ...current,
            session,
            progress:
              session.status === "cleared" ? "clearing" : current.progress,
          };
    });
  }, []);

  const erase = useCallback(() => {
    setPlay((current) => {
      const cellIndex = current.selectedCellIndex;
      if (cellIndex === null) {
        return current;
      }

      const session = clearSudokuCell(current.session, cellIndex);
      return session === current.session ? current : { ...current, session };
    });
  }, []);

  const toggleNotesMode = useCallback(() => {
    setPlay((current) => ({ ...current, notesMode: !current.notesMode }));
  }, []);

  const undo = useCallback(() => {
    setPlay((current) => {
      const session = undoSudokuSession(current.session);
      return session === current.session ? current : { ...current, session };
    });
  }, []);

  const restart = useCallback(() => {
    setPlay((current) => ({
      ...current,
      session: restartSudokuSession(current.session),
      selectedCellIndex: null,
      notesMode: false,
      progress: "playing",
    }));
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setPlay((current) => ({
      ...current,
      session: createSudokuSession(current.session.problem, startedAt),
      selectedCellIndex: null,
      notesMode: false,
      progress: "playing",
    }));
  }, []);

  const newGame = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setPlay(createReactState(startedAt));
  }, []);

  const completeClearPresentation = useCallback(() => {
    setPlay((current) =>
      current.session.status === "cleared" && current.progress === "clearing"
        ? { ...current, progress: "result" }
        : current,
    );
  }, []);

  const { session } = play;
  const conflictCellIndices = useMemo(
    () => findSudokuConflictCellIndices(session.board),
    [session.board],
  );
  const mistakeCellIndices = useMemo(
    () => findSudokuMistakeCellIndices(session),
    [session],
  );
  const elapsedMs = getSudokuSessionElapsedMs(session, now);
  const sessionResult = useMemo(
    () => getSudokuSessionResult(session, now),
    [now, session],
  );
  const result = useMemo<SudokuResult | null>(
    () =>
      sessionResult
        ? { ...sessionResult, problemIdentity: play.problemIdentity }
        : null,
    [play.problemIdentity, sessionResult],
  );

  return {
    difficulty,
    status: session.status,
    progress: play.progress,
    clues: session.problem.clues,
    board: session.board,
    notes: session.notes,
    problemIdentity: play.problemIdentity,
    selectedCellIndex: play.selectedCellIndex,
    conflictCellIndices,
    mistakeCellIndices,
    notesMode: play.notesMode,
    elapsedMs,
    mistakeCount: session.mistakeCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    canUndo: canUndoSudokuSession(session),
    result,
    selectCell,
    inputDigit,
    erase,
    toggleNotesMode,
    undo,
    restart,
    replay,
    newGame,
    completeClearPresentation,
  };
}
