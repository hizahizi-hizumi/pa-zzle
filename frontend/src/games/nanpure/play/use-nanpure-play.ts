import { useCallback, useMemo, useRef, useState } from "react";
import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import type {
  NanpureIdentifiedProblem,
  NanpureProblemIdentity,
} from "@/games/nanpure/problem/problem";
import { selectNanpureProblemForDifficulty } from "@/games/nanpure/problem-selection";
import type { NanpureBoard, NanpureDigit } from "@/games/nanpure/puzzle/board";
import { findNanpureConflictCellIndices } from "@/games/nanpure/puzzle/rules";
import {
  calculateNanpurePlayScore,
  calculateNanpureSpeedScoreRule,
  type NanpurePlayScore,
} from "@/games/nanpure/score";
import {
  canRestartNanpureSession,
  canUndoNanpureSession,
  clearNanpureSessionCell,
  createNanpureSession,
  enterNanpureSessionDigit,
  findNanpureSessionCompletedDigits,
  findNanpureSessionMistakeCellIndices,
  getNanpureSessionResult,
  type NanpureNotes,
  type NanpureSession,
  type NanpureSessionResult,
  restartNanpureSession,
  toggleNanpureSessionNote,
  undoNanpureSession,
} from "@/games/nanpure/session/session";
import {
  applyPlaySession,
  completePlayClearAnimation,
  type GamePlay,
  type GameProgress,
  type RestartableGamePlay,
  startPlaySession,
  type UndoableGamePlay,
  useSessionElapsedMs,
} from "@/games/play";
import { createProblemId, type ProblemId } from "@/games/problem-id";
import { selectProblemAvoiding } from "@/games/problem-selection";
import { calculateTimeDeltaMs, type SpeedScoreRule } from "@/games/score";

/**
 * 盤面を変えた操作の知らせ。効果音を鳴らすため、操作ごとに増える `id` を付ける。
 * `mistake-entered` は完成解と異なる数字を入れてミスに数えた入力、`digit-entered` はそれ以外の数字の入力。
 */
export type NanpureOperation = {
  id: number;
  type:
    | "digit-entered"
    | "mistake-entered"
    | "note-added"
    | "note-removed"
    | "erased";
};

export type NanpureResult = NanpureSessionResult & {
  speedRule: SpeedScoreRule;
  timeDeltaMs: number;
  score: NanpurePlayScore;
};

/** 完了したプレイの事実から結果を作る。プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createNanpureResult(
  sessionResult: NanpureSessionResult,
): NanpureResult {
  const speedRule = calculateNanpureSpeedScoreRule();
  return {
    ...sessionResult,
    speedRule,
    timeDeltaMs: calculateTimeDeltaMs(sessionResult.elapsedMs, speedRule),
    score: calculateNanpurePlayScore(sessionResult),
  };
}

export type NanpurePlay = GamePlay<
  NanpureDifficulty,
  NanpureProblemIdentity,
  NanpureSession,
  NanpureResult
> &
  RestartableGamePlay &
  UndoableGamePlay & {
    clues: NanpureBoard;
    board: NanpureBoard;
    notes: NanpureNotes;
    selectedCellIndex: number | null;
    conflictCellIndices: number[];
    mistakeCellIndices: number[];
    completedDigits: NanpureDigit[];
    notesMode: boolean;
    operation: NanpureOperation | null;
    mistakeCount: number;
    undoCount: number;
    restartCount: number;
    selectCell: (cellIndex: number) => void;
    inputDigit: (digit: NanpureDigit) => void;
    erase: () => void;
    toggleNotesMode: () => void;
  };

type NanpurePlayState = {
  session: NanpureSession;
  problemIdentity: NanpureProblemIdentity;
  selectedCellIndex: number | null;
  notesMode: boolean;
  progress: GameProgress;
  operation: NanpureOperation | null;
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
    operation: null,
  };
}

/** session を進め、盤面が変わったときだけ操作の知らせを添える。 */
function applyOperatedSession(
  state: NanpurePlayState,
  session: NanpureSession,
  operation: NanpureOperation,
): NanpurePlayState {
  const next = applyPlaySession(state, session);
  return next === state ? state : { ...next, operation };
}

function getNoteOperationType(
  notes: NanpureNotes,
  cellIndex: number,
  digit: NanpureDigit,
): NanpureOperation["type"] {
  return notes[cellIndex]?.includes(digit) ? "note-removed" : "note-added";
}

function selectProblem(
  difficulty: NanpureDifficulty,
  avoidedProblemId: ProblemId | undefined,
): NanpureIdentifiedProblem {
  return selectProblemAvoiding(
    (seed) => selectNanpureProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

/**
 * `initialProblem` を渡すと、その問題で始める。渡さなければ難易度の問題集から `avoidedProblemId` の問題を避けて選ぶ。
 * `startNewProblem` は問題集から別の問題を選び直す。
 */
export function useNanpurePlay(
  difficulty: NanpureDifficulty,
  initialProblem?: NanpureIdentifiedProblem,
  avoidedProblemId?: ProblemId,
): NanpurePlay {
  const [play, setPlay] = useState<NanpurePlayState>(() =>
    createPlayState(
      initialProblem ?? selectProblem(difficulty, avoidedProblemId),
      Date.now(),
    ),
  );
  const { session, problemIdentity } = play;
  const elapsedMs = useSessionElapsedMs(session);
  const nextOperationId = useRef(0);

  const selectCell = useCallback((cellIndex: number) => {
    setPlay((current) => ({ ...current, selectedCellIndex: cellIndex }));
  }, []);

  const inputDigit = useCallback((digit: NanpureDigit) => {
    const enteredAt = Date.now();
    const operationId = nextOperationId.current++;
    setPlay((current) => {
      const cellIndex = current.selectedCellIndex;
      if (cellIndex === null) {
        return current;
      }

      if (current.notesMode) {
        return applyOperatedSession(
          current,
          toggleNanpureSessionNote(current.session, cellIndex, digit),
          {
            id: operationId,
            type: getNoteOperationType(current.session.notes, cellIndex, digit),
          },
        );
      }

      const session = enterNanpureSessionDigit(
        current.session,
        cellIndex,
        digit,
        enteredAt,
      );
      return applyOperatedSession(current, session, {
        id: operationId,
        type:
          session.mistakeCount > current.session.mistakeCount
            ? "mistake-entered"
            : "digit-entered",
      });
    });
  }, []);

  const erase = useCallback(() => {
    const operationId = nextOperationId.current++;
    setPlay((current) => {
      const cellIndex = current.selectedCellIndex;
      if (cellIndex === null) {
        return current;
      }

      return applyOperatedSession(
        current,
        clearNanpureSessionCell(current.session, cellIndex),
        { id: operationId, type: "erased" },
      );
    });
  }, []);

  const toggleNotesMode = useCallback(() => {
    setPlay((current) => ({ ...current, notesMode: !current.notesMode }));
  }, []);

  const undo = useCallback(() => {
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        undoNanpureSession(current.session),
      );
      return next === current ? current : { ...next, operation: null };
    });
  }, []);

  const restart = useCallback(() => {
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        restartNanpureSession(current.session),
      );
      return next === current
        ? current
        : {
            ...next,
            selectedCellIndex: null,
            notesMode: false,
            operation: null,
          };
    });
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) => ({
      ...startPlaySession(
        current,
        createNanpureSession(current.session.problem, startedAt),
      ),
      selectedCellIndex: null,
      notesMode: false,
      operation: null,
    }));
  }, []);

  const startNewProblem = useCallback(() => {
    setPlay(
      createPlayState(
        selectProblem(difficulty, createProblemId(problemIdentity)),
        Date.now(),
      ),
    );
  }, [difficulty, problemIdentity]);

  const completeClearAnimation = useCallback(() => {
    setPlay(completePlayClearAnimation);
  }, []);

  const conflictCellIndices = useMemo(
    () => findNanpureConflictCellIndices(session.puzzleState),
    [session.puzzleState],
  );
  const mistakeCellIndices = useMemo(
    () => findNanpureSessionMistakeCellIndices(session),
    [session],
  );
  const completedDigits = useMemo(
    () => findNanpureSessionCompletedDigits(session),
    [session],
  );
  const result = useMemo(() => {
    const sessionResult = getNanpureSessionResult(session);
    return sessionResult ? createNanpureResult(sessionResult) : null;
  }, [session]);

  return {
    difficulty,
    problemIdentity,
    session,
    status: session.status,
    progress: play.progress,
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
    elapsedMs,
    result,
    clues: session.problem.clues,
    board: session.puzzleState,
    notes: session.notes,
    selectedCellIndex: play.selectedCellIndex,
    conflictCellIndices,
    mistakeCellIndices,
    completedDigits,
    notesMode: play.notesMode,
    operation: play.operation,
    mistakeCount: session.mistakeCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    canUndo: canUndoNanpureSession(session),
    canRestart: canRestartNanpureSession(session),
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
