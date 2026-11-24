import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MagicSquareDifficulty } from "@/games/magic-square/difficulty";
import type {
  MagicSquareProblemIdentity,
  MagicSquareSolveWorkload,
} from "@/games/magic-square/problem/problem";
import type { MagicSquarePooledProblem } from "@/games/magic-square/problem/problem-pool";
import { selectMagicSquareProblemForDifficulty } from "@/games/magic-square/problem-selection";
import type { MagicSquareBoard } from "@/games/magic-square/puzzle/board";
import {
  listMagicSquareLineEvaluations,
  type MagicSquareLineEvaluation,
  type MagicSquareValueState,
} from "@/games/magic-square/puzzle/rules";
import type { MagicSquareState } from "@/games/magic-square/puzzle/state";
import {
  calculateMagicSquarePlayScore,
  calculateMagicSquareSpeedScoreRule,
  type MagicSquarePlayScore,
} from "@/games/magic-square/score";
import {
  canRestartMagicSquareSession,
  canUndoMagicSquareSession,
  createMagicSquareSession,
  enterMagicSquareSessionValue,
  getMagicSquareSessionCorrectionCount,
  getMagicSquareSessionResult,
  listMagicSquareSessionValueStates,
  type MagicSquareInputMode,
  type MagicSquareSession,
  type MagicSquareSessionResult,
  restartMagicSquareSession,
  selectMagicSquareSessionCell,
  toggleMagicSquareSessionMemo,
  undoMagicSquareSession,
} from "@/games/magic-square/session/session";
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
import {
  restorePlayState,
  savePlayState,
} from "@/games/play-state-persistence";
import { createProblemId, type ProblemId } from "@/games/problem-id";
import { selectProblemAvoiding } from "@/games/problem-selection";
import { calculateTimeDeltaMs, type SpeedScoreRule } from "@/games/score";

/**
 * 数の欄を押した結果の知らせ。効果音と、受け付けなかったときの盤面の反応に使う。`id` は押すたびに増える。
 * - `placed`: 選んだマスに数を置いた（置き換えを含む）。
 * - `removed`: 選んだマスに置いてあった同じ数を外した。
 * - `memo-written`・`memo-erased`: 選んだマスのメモに数を書いた・消した。
 * - `rejected`: 受け付けなかった。`cellIndex` は選んでいたマスで、どのマスも選んでいなければ `null`。
 */
export type MagicSquareOperation =
  | {
      id: number;
      type: "placed" | "removed" | "memo-written" | "memo-erased";
      cellIndex: number;
      value: number;
    }
  | { id: number; type: "rejected"; cellIndex: number | null; value: number };

export type MagicSquareResult = MagicSquareSessionResult & {
  workload: MagicSquareSolveWorkload;
  speedRule: SpeedScoreRule;
  timeDeltaMs: number;
  score: MagicSquarePlayScore;
};

export function createMagicSquareResult(
  sessionResult: MagicSquareSessionResult,
  workload: MagicSquareSolveWorkload,
): MagicSquareResult {
  const speedRule = calculateMagicSquareSpeedScoreRule(workload);
  return {
    ...sessionResult,
    workload,
    speedRule,
    timeDeltaMs: calculateTimeDeltaMs(sessionResult.elapsedMs, speedRule),
    score: calculateMagicSquarePlayScore({ ...sessionResult, workload }),
  };
}

export type MagicSquarePlay = GamePlay<
  MagicSquareDifficulty,
  MagicSquareProblemIdentity,
  MagicSquareSession,
  MagicSquareResult
> &
  RestartableGamePlay &
  UndoableGamePlay & {
    /** 最初から置いてある数。 */
    givens: MagicSquareBoard;
    /** 最初から置いてある数を含む今の盤面。 */
    board: MagicSquareState;
    selectedCellIndex: number | null;
    /** 列ごとの今の合計と状態。並びは `listMagicSquareLines` と同じ。 */
    lineEvaluations: readonly MagicSquareLineEvaluation[];
    inputMode: MagicSquareInputMode;
    /** 数の欄の 1 から n² までの、今の入れ方での状態。 */
    valueStates: readonly MagicSquareValueState[];
    correctionCount: number;
    operation: MagicSquareOperation | null;
    selectCell: (cellIndex: number) => void;
    /** 数の欄で押した数を、今の入れ方で選んだマスに入れる。同じ数が入っていれば外す・消す。 */
    enterValue: (value: number) => void;
    /** 数を置く入れ方と、メモを書く入れ方を切り替える。 */
    toggleMemoInput: () => void;
  };

type MagicSquarePlayState = {
  session: MagicSquareSession;
  problemIdentity: MagicSquareProblemIdentity;
  workload: MagicSquareSolveWorkload;
  progress: GameProgress;
  inputMode: MagicSquareInputMode;
  operation: MagicSquareOperation | null;
};

function createPlayState(
  { problem, identity, workload }: MagicSquarePooledProblem,
  startedAt: number,
): MagicSquarePlayState {
  return {
    session: createMagicSquareSession(problem, startedAt),
    problemIdentity: identity,
    workload,
    progress: "playing",
    inputMode: "value",
    operation: null,
  };
}

function selectProblem(
  difficulty: MagicSquareDifficulty,
  avoidedProblemId: ProblemId | undefined,
): MagicSquarePooledProblem {
  return selectProblemAvoiding(
    (seed) => selectMagicSquareProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

/** 数の欄を押す以外の操作。盤面が変わったら、前の押した結果の知らせを消す。 */
function operateInPlay(
  current: MagicSquarePlayState,
  operate: (session: MagicSquareSession) => MagicSquareSession,
): MagicSquarePlayState {
  if (current.progress !== "playing") {
    return current;
  }
  const next = applyPlaySession(current, operate(current.session));
  return next === current ? current : { ...next, operation: null };
}

function describeAcceptedInput(
  inputMode: MagicSquareInputMode,
  session: MagicSquareSession,
  cellIndex: number,
  value: number,
): MagicSquareOperation["type"] {
  const { cells, memos } = session.puzzleState;
  if (inputMode === "memo") {
    return memos[cellIndex]?.includes(value) ? "memo-written" : "memo-erased";
  }
  return cells[cellIndex] === value ? "placed" : "removed";
}

function inputValueInPlay(
  current: MagicSquarePlayState,
  value: number,
  inputAt: number,
  operationId: number,
): MagicSquarePlayState {
  if (current.progress !== "playing") {
    return current;
  }
  const { session, inputMode } = current;
  const { selectedCellIndex: cellIndex } = session;
  const operated =
    inputMode === "memo"
      ? toggleMagicSquareSessionMemo(session, value, inputAt)
      : enterMagicSquareSessionValue(session, value, inputAt);
  if (operated === session || cellIndex === null) {
    return {
      ...current,
      operation: { id: operationId, type: "rejected", cellIndex, value },
    };
  }
  return {
    ...applyPlaySession(current, operated),
    operation: {
      id: operationId,
      type: describeAcceptedInput(inputMode, operated, cellIndex, value),
      cellIndex,
      value,
    },
  };
}

/** `initialProblem` を渡すと、その問題で始める。渡さなければ `avoidedProblemId` の問題を避けて選ぶ。 */
export function useMagicSquarePlay(
  difficulty: MagicSquareDifficulty,
  initialProblem?: MagicSquarePooledProblem,
  avoidedProblemId?: ProblemId,
  playProblemId?: ProblemId,
): MagicSquarePlay {
  const [play, setPlay] = useState<MagicSquarePlayState>(() =>
    restorePlayState("magic-square", playProblemId, () =>
      createPlayState(
        initialProblem ?? selectProblem(difficulty, avoidedProblemId),
        Date.now(),
      ),
    ),
  );
  useEffect(
    () => savePlayState("magic-square", playProblemId, play),
    [playProblemId, play],
  );
  const { session, problemIdentity, workload, inputMode } = play;
  const elapsedMs = useSessionElapsedMs(session);
  // 復元した知らせと同じ番号を次の操作に付けると、その操作の音と反応が出ないので、続きの番号から振る。
  const nextOperationId = useRef((play.operation?.id ?? -1) + 1);

  const selectCell = useCallback((cellIndex: number) => {
    setPlay((current) =>
      operateInPlay(current, (operated) =>
        selectMagicSquareSessionCell(operated, cellIndex),
      ),
    );
  }, []);

  const enterValue = useCallback((value: number) => {
    const enteredAt = Date.now();
    const operationId = nextOperationId.current++;
    setPlay((current) =>
      inputValueInPlay(current, value, enteredAt, operationId),
    );
  }, []);

  const toggleMemoInput = useCallback(() => {
    setPlay((current) =>
      current.progress === "playing"
        ? {
            ...current,
            inputMode: current.inputMode === "memo" ? "value" : "memo",
          }
        : current,
    );
  }, []);

  const undo = useCallback(() => {
    setPlay((current) => operateInPlay(current, undoMagicSquareSession));
  }, []);

  const restart = useCallback(() => {
    setPlay((current) => operateInPlay(current, restartMagicSquareSession));
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) => ({
      ...startPlaySession(
        current,
        createMagicSquareSession(current.session.problem, startedAt),
      ),
      inputMode: "value",
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

  const result = useMemo(() => {
    const sessionResult = getMagicSquareSessionResult(session);
    return sessionResult
      ? createMagicSquareResult(sessionResult, workload)
      : null;
  }, [session, workload]);
  const lineEvaluations = useMemo(
    () => listMagicSquareLineEvaluations(session.puzzleState),
    [session.puzzleState],
  );
  const valueStates = useMemo(
    () => listMagicSquareSessionValueStates(session, inputMode),
    [session, inputMode],
  );

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
    givens: session.problem.givens,
    board: session.puzzleState,
    selectedCellIndex: session.selectedCellIndex,
    lineEvaluations,
    inputMode,
    valueStates,
    correctionCount: getMagicSquareSessionCorrectionCount(session),
    operation: play.operation,
    canUndo: canUndoMagicSquareSession(session),
    canRestart: canRestartMagicSquareSession(session),
    selectCell,
    enterValue,
    toggleMemoInput,
    undo,
    restart,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}
