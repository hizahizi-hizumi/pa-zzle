import { useCallback, useEffect, useMemo, useState } from "react";
import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import type {
  NanpureIdentifiedProblem,
  NanpureProblemIdentity,
} from "@/games/nanpure/problem/problem";
import { selectNanpureProblemForDifficulty } from "@/games/nanpure/problem-selection";
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
import { createProblemId, type ProblemId } from "@/games/problem-id";
import { selectProblemAvoiding } from "@/games/problem-selection";

export type NanpureProgress = "playing" | "clearing" | "result";

export type NanpureResult = NanpureSessionResult & {
  problemIdentity: NanpureProblemIdentity;
  score: NanpurePlayScore;
};

/** 完了したプレイの事実から結果を作る。プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createNanpureResult(
  sessionResult: NanpureSessionResult,
  problemIdentity: NanpureProblemIdentity,
): NanpureResult {
  return {
    ...sessionResult,
    problemIdentity,
    score: calculateNanpurePlayScore(sessionResult),
  };
}

type NanpurePlayState = {
  session: NanpureSession;
  problemIdentity: NanpureProblemIdentity;
  selectedCellIndex: number | null;
  notesMode: boolean;
  progress: NanpureProgress;
};

function createPlayState(
  { problem, identity }: NanpureIdentifiedProblem,
  startedAt: number,
): NanpurePlayState {
  return {
    session: createNanpureSession(problem, startedAt),
    problemIdentity: identity,
    selectedCellIndex: null,
    notesMode: false,
    progress: "playing",
  };
}

function createSelectedPlayState(
  difficulty: NanpureDifficulty,
  avoidedProblemId: ProblemId | undefined,
  startedAt: number,
): NanpurePlayState {
  const { problem } = selectProblemAvoiding(
    (seed) => selectNanpureProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  );
  return createPlayState(problem, startedAt);
}

/**
 * `initialProblem` を渡すと、その問題で始める。渡さなければ難易度の問題集から `avoidedProblemId` の問題を避けて選ぶ。
 * `startNewProblem` は問題集から遊んでいる問題を避けて選び直す。
 */
export function useNanpurePlay(
  difficulty: NanpureDifficulty,
  initialProblem?: NanpureIdentifiedProblem,
  avoidedProblemId?: ProblemId,
) {
  const [play, setPlay] = useState<NanpurePlayState>(() =>
    initialProblem
      ? createPlayState(initialProblem, Date.now())
      : createSelectedPlayState(difficulty, avoidedProblemId, Date.now()),
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
    setPlay((current) =>
      createSelectedPlayState(
        difficulty,
        createProblemId(current.problemIdentity),
        startedAt,
      ),
    );
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
        ? createNanpureResult(sessionResult, play.problemIdentity)
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
