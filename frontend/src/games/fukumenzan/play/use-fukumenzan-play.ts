import { useCallback, useEffect, useMemo, useState } from "react";
import type { FukumenzanDifficulty } from "@/games/fukumenzan/difficulty";
import type {
  FukumenzanProblem,
  FukumenzanProblemIdentity,
} from "@/games/fukumenzan/problem/problem";
import type { FukumenzanPooledProblem } from "@/games/fukumenzan/problem/problem-pool";
import {
  type FukumenzanWorkload,
  measureFukumenzanWorkload,
} from "@/games/fukumenzan/problem/workload";
import { selectFukumenzanProblemForDifficulty } from "@/games/fukumenzan/problem-selection";
import { listFukumenzanLetters } from "@/games/fukumenzan/puzzle/equation";
import {
  listFukumenzanLeadingZeroLetters,
  listFukumenzanMiscalculatedColumns,
} from "@/games/fukumenzan/puzzle/rules";
import type {
  FukumenzanDigit,
  FukumenzanPuzzleState,
} from "@/games/fukumenzan/puzzle/state";
import {
  calculateFukumenzanPlayScore,
  calculateFukumenzanSpeedScoreRule,
  type FukumenzanPlayScore,
} from "@/games/fukumenzan/score";
import {
  canRestartFukumenzanSession,
  canUndoFukumenzanSession,
  createFukumenzanSession,
  type FukumenzanSession,
  type FukumenzanSessionResult,
  getFukumenzanSessionResult,
  placeFukumenzanSessionDigit,
  restartFukumenzanSession,
  returnFukumenzanSessionDigit,
  toggleFukumenzanSessionCross,
  undoFukumenzanSession,
} from "@/games/fukumenzan/session/session";
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

export type FukumenzanResult = FukumenzanSessionResult & {
  workload: FukumenzanWorkload;
  speedRule: SpeedScoreRule;
  timeDeltaMs: number;
  score: FukumenzanPlayScore;
};

export type FukumenzanPlay = GamePlay<
  FukumenzanDifficulty,
  FukumenzanProblemIdentity,
  FukumenzanSession,
  FukumenzanResult
> &
  RestartableGamePlay &
  UndoableGamePlay & {
    problem: FukumenzanProblem;
    /** 式に出る文字。盤面の文字の番号はこの並びの位置。 */
    letters: readonly string[];
    puzzleState: FukumenzanPuzzleState;
    leadingZeroLetters: readonly number[];
    /** 一の位から数えた位。 */
    miscalculatedColumns: readonly number[];
    undoCount: number;
    placeDigit: (letter: number, digit: FukumenzanDigit) => void;
    returnDigit: (letter: number) => void;
    toggleCross: (letter: number, digit: FukumenzanDigit) => void;
  };

type FukumenzanPlayState = {
  problemIdentity: FukumenzanProblemIdentity;
  workload: FukumenzanWorkload;
  session: FukumenzanSession;
  progress: GameProgress;
};

function createPlayState(
  { problem, identity }: FukumenzanPooledProblem,
  startedAt: number,
): FukumenzanPlayState {
  return {
    problemIdentity: identity,
    workload: measureFukumenzanWorkload(problem),
    session: createFukumenzanSession(problem, startedAt),
    progress: "playing",
  };
}

/** プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createFukumenzanResult(
  sessionResult: FukumenzanSessionResult,
  workload: FukumenzanWorkload,
): FukumenzanResult {
  const speedRule = calculateFukumenzanSpeedScoreRule(workload);
  return {
    ...sessionResult,
    workload,
    speedRule,
    timeDeltaMs: calculateTimeDeltaMs(sessionResult.elapsedMs, speedRule),
    score: calculateFukumenzanPlayScore({
      elapsedMs: sessionResult.elapsedMs,
      workload,
    }),
  };
}

function selectProblem(
  difficulty: FukumenzanDifficulty,
  avoidedProblemId: ProblemId | undefined,
): FukumenzanPooledProblem {
  return selectProblemAvoiding(
    (seed) => selectFukumenzanProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

export function useFukumenzanPlay(
  difficulty: FukumenzanDifficulty,
  initialProblem?: FukumenzanPooledProblem,
  avoidedProblemId?: ProblemId,
  playProblemId?: ProblemId,
): FukumenzanPlay {
  const [play, setPlay] = useState(() =>
    restorePlayState("fukumenzan", playProblemId, () =>
      createPlayState(
        initialProblem ?? selectProblem(difficulty, avoidedProblemId),
        Date.now(),
      ),
    ),
  );
  useEffect(
    () => savePlayState("fukumenzan", playProblemId, play),
    [playProblemId, play],
  );
  const { session, progress, problemIdentity, workload } = play;
  const elapsedMs = useSessionElapsedMs(session);
  const { problem, puzzleState } = session;

  const placeDigit = useCallback((letter: number, digit: FukumenzanDigit) => {
    const operatedAt = Date.now();
    setPlay((current) =>
      applyPlaySession(
        current,
        placeFukumenzanSessionDigit(current.session, letter, digit, operatedAt),
      ),
    );
  }, []);

  const returnDigit = useCallback((letter: number) => {
    setPlay((current) =>
      applyPlaySession(
        current,
        returnFukumenzanSessionDigit(current.session, letter),
      ),
    );
  }, []);

  const toggleCross = useCallback((letter: number, digit: FukumenzanDigit) => {
    setPlay((current) =>
      applyPlaySession(
        current,
        toggleFukumenzanSessionCross(current.session, letter, digit),
      ),
    );
  }, []);

  const undo = useCallback(() => {
    setPlay((current) =>
      applyPlaySession(current, undoFukumenzanSession(current.session)),
    );
  }, []);

  const restart = useCallback(() => {
    setPlay((current) =>
      applyPlaySession(current, restartFukumenzanSession(current.session)),
    );
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) =>
      startPlaySession(
        current,
        createFukumenzanSession(current.session.problem, startedAt),
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

  const letters = useMemo(() => listFukumenzanLetters(problem), [problem]);
  const leadingZeroLetters = useMemo(
    () => listFukumenzanLeadingZeroLetters(problem, puzzleState),
    [problem, puzzleState],
  );
  const miscalculatedColumns = useMemo(
    () => listFukumenzanMiscalculatedColumns(problem, puzzleState),
    [problem, puzzleState],
  );

  const result = useMemo(() => {
    const sessionResult = getFukumenzanSessionResult(session);
    return sessionResult
      ? createFukumenzanResult(sessionResult, workload)
      : null;
  }, [session, workload]);

  return {
    difficulty,
    problemIdentity,
    session,
    status: session.status,
    progress,
    startedAt: session.startedAt,
    completedAt: session.clearedAt,
    elapsedMs,
    result,
    problem,
    letters,
    puzzleState,
    leadingZeroLetters,
    miscalculatedColumns,
    undoCount: session.undoCount,
    canUndo: canUndoFukumenzanSession(session),
    canRestart: canRestartFukumenzanSession(session),
    placeDigit,
    returnDigit,
    toggleCross,
    undo,
    restart,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}
