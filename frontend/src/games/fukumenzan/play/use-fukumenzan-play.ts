import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  type FukumenzanDigit,
  type FukumenzanPuzzleState,
  findFukumenzanCrossChangedLetter,
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

/**
 * 待ったで × の付け外しを戻した文字。盤面がその文字を選び、戻った × を見せる。
 * `id` は待ったごとに変わり、同じ文字が続いても別の待ったとして見分けられるようにする。
 */
export type FukumenzanCrossUndoNotice = { id: number; letter: number };

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
    /** 最後の待ったが × を戻さなかったときと、盤面を戻した後は `null`。 */
    crossUndoNotice: FukumenzanCrossUndoNotice | null;
    placeDigit: (letter: number, digit: FukumenzanDigit) => void;
    returnDigit: (letter: number) => void;
    toggleCross: (letter: number, digit: FukumenzanDigit) => void;
  };

type FukumenzanPlayState = {
  problemIdentity: FukumenzanProblemIdentity;
  workload: FukumenzanWorkload;
  session: FukumenzanSession;
  progress: GameProgress;
  crossUndoNotice: FukumenzanCrossUndoNotice | null;
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
    crossUndoNotice: null,
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

  const nextUndoId = useRef(0);

  const undo = useCallback(() => {
    const id = nextUndoId.current++;
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        undoFukumenzanSession(current.session),
      );
      if (next === current) {
        return current;
      }
      const letter = findFukumenzanCrossChangedLetter(
        current.session.puzzleState,
        next.session.puzzleState,
      );
      return {
        ...next,
        crossUndoNotice: letter === null ? null : { id, letter },
      };
    });
  }, []);

  const restart = useCallback(() => {
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        restartFukumenzanSession(current.session),
      );
      return next === current ? current : { ...next, crossUndoNotice: null };
    });
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) => ({
      ...startPlaySession(
        current,
        createFukumenzanSession(current.session.problem, startedAt),
      ),
      crossUndoNotice: null,
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
    crossUndoNotice: play.crossUndoNotice,
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
