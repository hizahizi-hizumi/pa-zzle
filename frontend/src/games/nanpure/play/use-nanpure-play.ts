import { useCallback, useMemo, useRef, useState } from "react";
import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import type {
  NanpureIdentifiedProblem,
  NanpureProblemIdentity,
} from "@/games/nanpure/problem/problem";
import { selectNanpureProblemForDifficulty } from "@/games/nanpure/problem-selection";
import type { NanpureBoard, NanpureDigit } from "@/games/nanpure/puzzle/board";
import {
  findNanpureConflictCellIndices,
  findNanpureUnitsCompletedAt,
  type NanpureUnit,
} from "@/games/nanpure/puzzle/rules";
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
 * 効果音と盤面の反応のため、操作ごとに増える `id` を付ける。
 * `mistake-entered` は完成解と異なる数字を入れてミスに数えた入力、`digit-entered` はそれ以外の数字の入力。
 * `completedUnits` は、その数字で解どおりに埋まりきった行・列・ブロック。盤面が完成した入力では空にし、完成の演出に任せる。
 */
export type NanpureOperation =
  | {
      id: number;
      type: "digit-entered";
      cellIndex: number;
      completedUnits: readonly NanpureUnit[];
    }
  | {
      id: number;
      type: "mistake-entered";
      cellIndex: number;
    }
  | {
      id: number;
      type: "note-added" | "note-removed";
    };

export type NanpureResult = NanpureSessionResult & {
  speedRule: SpeedScoreRule;
  timeDeltaMs: number;
  score: NanpurePlayScore;
};

/** プレイ中の結果と、記録から作り直す結果で共用する。 */
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
    /** 数字ボタンの長押しで固めた数字。固めている間は、マスを押すだけでその数字を置く。 */
    lockedDigit: NanpureDigit | null;
    operation: NanpureOperation | null;
    mistakeCount: number;
    undoCount: number;
    restartCount: number;
    selectCell: (cellIndex: number) => void;
    /** 数字を固めている間は、置かずに固める数字を替える。固めた数字を押すと固めを解く。 */
    inputDigit: (digit: NanpureDigit) => void;
    lockDigit: (digit: NanpureDigit) => void;
    erase: () => void;
    toggleNotesMode: () => void;
  };

type NanpurePlayState = {
  session: NanpureSession;
  problemIdentity: NanpureProblemIdentity;
  selectedCellIndex: number | null;
  notesMode: boolean;
  lockedDigit: NanpureDigit | null;
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
    lockedDigit: null,
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

export function createNanpureDigitOperation(
  id: number,
  cellIndex: number,
  mistaken: boolean,
  completedUnits: readonly NanpureUnit[] = [],
): NanpureOperation {
  return mistaken
    ? { id, type: "mistake-entered", cellIndex }
    : { id, type: "digit-entered", cellIndex, completedUnits };
}

/** 選んだマスへの数字の入力。メモの入力中はメモを付け外しする。 */
function inputDigitAt(
  current: NanpurePlayState,
  cellIndex: number,
  digit: NanpureDigit,
  operationId: number,
  enteredAt: number,
): NanpurePlayState {
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
  const next = applyOperatedSession(
    current,
    session,
    createNanpureDigitOperation(
      operationId,
      cellIndex,
      session.mistakeCount > current.session.mistakeCount,
      session.status === "playing"
        ? findNanpureUnitsCompletedAt(
            session.puzzleState,
            session.problem.solution,
            cellIndex,
          )
        : [],
    ),
  );
  // 置ききった数字は押せなくなるので、固めたままにしない。
  return next.lockedDigit !== null &&
    findNanpureSessionCompletedDigits(next.session).includes(next.lockedDigit)
    ? { ...next, lockedDigit: null }
    : next;
}

function getNoteOperationType(
  notes: NanpureNotes,
  cellIndex: number,
  digit: NanpureDigit,
): "note-added" | "note-removed" {
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
    const enteredAt = Date.now();
    const operationId = nextOperationId.current++;
    setPlay((current) => {
      const selected = { ...current, selectedCellIndex: cellIndex };
      return current.lockedDigit === null
        ? selected
        : inputDigitAt(
            selected,
            cellIndex,
            current.lockedDigit,
            operationId,
            enteredAt,
          );
    });
  }, []);

  const inputDigit = useCallback((digit: NanpureDigit) => {
    const enteredAt = Date.now();
    const operationId = nextOperationId.current++;
    setPlay((current) => {
      if (current.lockedDigit !== null) {
        return {
          ...current,
          lockedDigit: current.lockedDigit === digit ? null : digit,
        };
      }

      const cellIndex = current.selectedCellIndex;
      return cellIndex === null
        ? current
        : inputDigitAt(current, cellIndex, digit, operationId, enteredAt);
    });
  }, []);

  const lockDigit = useCallback((digit: NanpureDigit) => {
    setPlay((current) =>
      findNanpureSessionCompletedDigits(current.session).includes(digit)
        ? current
        : { ...current, lockedDigit: digit },
    );
  }, []);

  const erase = useCallback(() => {
    setPlay((current) => {
      const cellIndex = current.selectedCellIndex;
      if (cellIndex === null) {
        return current;
      }

      const next = applyPlaySession(
        current,
        clearNanpureSessionCell(current.session, cellIndex),
      );
      return next === current ? current : { ...next, operation: null };
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
            lockedDigit: null,
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
      lockedDigit: null,
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
    completedAt: session.clearedAt,
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
    lockedDigit: play.lockedDigit,
    operation: play.operation,
    mistakeCount: session.mistakeCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    canUndo: canUndoNanpureSession(session),
    canRestart: canRestartNanpureSession(session),
    selectCell,
    inputDigit,
    lockDigit,
    erase,
    toggleNotesMode,
    undo,
    restart,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}
