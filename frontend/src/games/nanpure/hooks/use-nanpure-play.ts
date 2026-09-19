import { useCallback, useEffect, useMemo, useState } from "react";
import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import type { NanpureProblemIdentity } from "@/games/nanpure/problem/problem";
import { generateNanpureProblemForDifficulty } from "@/games/nanpure/problem/selection";
import type { NanpureDigit } from "@/games/nanpure/puzzle/board";
import { findNanpureConflictCellIndices } from "@/games/nanpure/puzzle/rules";
import {
  calculateNanpurePlayScore,
  type NanpurePlayScore,
} from "@/games/nanpure/score";
import {
  canUndoNanpureSession,
  clearNanpureCell,
  createNanpureSession,
  enterNanpureDigit,
  findCompletedNanpureDigits,
  findNanpureMistakeCellIndices,
  getNanpureSessionElapsedMs,
  getNanpureSessionResult,
  type NanpureSession,
  type NanpureSessionResult,
  restartNanpureSession,
  toggleNanpureNote,
  undoNanpureSession,
} from "@/games/nanpure/session/session";
import { createProblemSeed, type ProblemSeed } from "@/games/problem-seed";

export type NanpureProgress = "playing" | "clearing" | "result";

export type NanpureResult = NanpureSessionResult & {
  problemIdentity: NanpureProblemIdentity;
  score: NanpurePlayScore;
};

type NanpurePlayState = {
  session: NanpureSession;
  problemIdentity: NanpureProblemIdentity;
  selectedCellIndex: number | null;
  notesMode: boolean;
  progress: NanpureProgress;
};

function createPlayState(
  difficulty: NanpureDifficulty,
  seed: ProblemSeed,
  startedAt: number,
): NanpurePlayState {
  const problem = generateNanpureProblemForDifficulty(difficulty, seed);

  return {
    session: createNanpureSession(problem, startedAt),
    problemIdentity: problem.identity,
    selectedCellIndex: null,
    notesMode: false,
    progress: "playing",
  };
}

export function useNanpurePlay(difficulty: NanpureDifficulty) {
  const [play, setPlay] = useState<NanpurePlayState>(() =>
    createPlayState(difficulty, createProblemSeed(), Date.now()),
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

  const inputDigit = useCallback((digit: NanpureDigit) => {
    const enteredAt = Date.now();
    setNow(enteredAt);
    setPlay((current) => {
      const cellIndex = current.selectedCellIndex;
      if (cellIndex === null) {
        return current;
      }

      const session = current.notesMode
        ? toggleNanpureNote(current.session, cellIndex, digit)
        : enterNanpureDigit(current.session, cellIndex, digit, enteredAt);

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

      const session = clearNanpureCell(current.session, cellIndex);
      return session === current.session ? current : { ...current, session };
    });
  }, []);

  const toggleNotesMode = useCallback(() => {
    setPlay((current) => ({ ...current, notesMode: !current.notesMode }));
  }, []);

  const undo = useCallback(() => {
    setPlay((current) => {
      const session = undoNanpureSession(current.session);
      return session === current.session ? current : { ...current, session };
    });
  }, []);

  const restart = useCallback(() => {
    setPlay((current) => ({
      ...current,
      session: restartNanpureSession(current.session),
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
      session: createNanpureSession(current.session.problem, startedAt),
      selectedCellIndex: null,
      notesMode: false,
      progress: "playing",
    }));
  }, []);

  const startNewProblem = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setPlay(createPlayState(difficulty, createProblemSeed(), startedAt));
  }, [difficulty]);

  const completeClearAnimation = useCallback(() => {
    setPlay((current) =>
      current.session.status === "cleared" && current.progress === "clearing"
        ? { ...current, progress: "result" }
        : current,
    );
  }, []);

  const { session } = play;
  const conflictCellIndices = useMemo(
    () => findNanpureConflictCellIndices(session.board),
    [session.board],
  );
  const mistakeCellIndices = useMemo(
    () => findNanpureMistakeCellIndices(session),
    [session],
  );
  const completedDigits = useMemo(
    () => findCompletedNanpureDigits(session),
    [session],
  );
  const elapsedMs = getNanpureSessionElapsedMs(session, now);
  const sessionResult = useMemo(
    () => getNanpureSessionResult(session, now),
    [now, session],
  );
  const result = useMemo<NanpureResult | null>(
    () =>
      sessionResult
        ? {
            ...sessionResult,
            problemIdentity: play.problemIdentity,
            score: calculateNanpurePlayScore(sessionResult),
          }
        : null,
    [play.problemIdentity, sessionResult],
  );

  return {
    difficulty,
    status: session.status,
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
    progress: play.progress,
    clues: session.problem.clues,
    board: session.board,
    notes: session.notes,
    problemIdentity: play.problemIdentity,
    selectedCellIndex: play.selectedCellIndex,
    conflictCellIndices,
    mistakeCellIndices,
    completedDigits,
    notesMode: play.notesMode,
    elapsedMs,
    mistakeCount: session.mistakeCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    canUndo: canUndoNanpureSession(session),
    result,
    selectCell,
    inputDigit,
    erase,
    toggleNotesMode,
    undo,
    restart,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}
