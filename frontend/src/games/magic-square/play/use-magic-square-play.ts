import { useCallback, useEffect, useMemo, useState } from "react";
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
  getMagicSquareSessionResult,
  getMagicSquareSessionWithdrawalCount,
  listMagicSquareSessionValueStates,
  type MagicSquareSession,
  type MagicSquareSessionResult,
  restartMagicSquareSession,
  selectMagicSquareSessionCell,
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
    /** 数の欄の 1 から n² までの状態。 */
    valueStates: readonly MagicSquareValueState[];
    withdrawalCount: number;
    selectCell: (cellIndex: number) => void;
    /** 選んだマスに数を入れる。同じ数が置いてあれば外す。 */
    enterValue: (value: number) => void;
  };

type MagicSquarePlayState = {
  session: MagicSquareSession;
  problemIdentity: MagicSquareProblemIdentity;
  workload: MagicSquareSolveWorkload;
  progress: GameProgress;
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

function operateInPlay(
  current: MagicSquarePlayState,
  operate: (session: MagicSquareSession) => MagicSquareSession,
): MagicSquarePlayState {
  return current.progress === "playing"
    ? applyPlaySession(current, operate(current.session))
    : current;
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
  const { session, problemIdentity, workload } = play;
  const elapsedMs = useSessionElapsedMs(session);

  const selectCell = useCallback((cellIndex: number) => {
    setPlay((current) =>
      operateInPlay(current, (operated) =>
        selectMagicSquareSessionCell(operated, cellIndex),
      ),
    );
  }, []);

  const enterValue = useCallback((value: number) => {
    const enteredAt = Date.now();
    setPlay((current) =>
      operateInPlay(current, (operated) =>
        enterMagicSquareSessionValue(operated, value, enteredAt),
      ),
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
    setPlay((current) =>
      startPlaySession(
        current,
        createMagicSquareSession(current.session.problem, startedAt),
      ),
    );
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
    () => listMagicSquareSessionValueStates(session),
    [session],
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
    valueStates,
    withdrawalCount: getMagicSquareSessionWithdrawalCount(session),
    canUndo: canUndoMagicSquareSession(session),
    canRestart: canRestartMagicSquareSession(session),
    selectCell,
    enterValue,
    undo,
    restart,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}
