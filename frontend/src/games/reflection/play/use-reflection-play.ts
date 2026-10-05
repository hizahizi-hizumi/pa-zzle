import { useCallback, useMemo, useState } from "react";

import {
  applyPlaySession,
  completePlayClearAnimation,
  type GamePlay,
  type GameProgress,
  type RestartableGamePlay,
  startPlaySession,
  useSessionElapsedMs,
} from "@/games/play";
import { createProblemId, type ProblemId } from "@/games/problem-id";
import { selectProblemAvoiding } from "@/games/problem-selection";
import type { ReflectionDifficulty } from "@/games/reflection/difficulty";
import type {
  ReflectionProblemIdentity,
  ReflectionSolveWorkload,
} from "@/games/reflection/problem/problem";
import type {
  ReflectionPooledProblem,
  ReflectionProblemPoolReference,
} from "@/games/reflection/problem/problem-pool";
import { selectReflectionProblemForDifficulty } from "@/games/reflection/problem-selection";
import type {
  ReflectionBoard,
  ReflectionInventory,
  ReflectionPiece,
} from "@/games/reflection/puzzle/board";
import {
  type ReflectionClue,
  type ReflectionEntry,
  type ReflectionLaserTrace,
  traceReflectionLaser,
} from "@/games/reflection/puzzle/laser";
import {
  calculateReflectionPlayScore,
  calculateReflectionSpeedScoreRule,
  type ReflectionPlayScore,
} from "@/games/reflection/score";
import {
  canRestartReflectionSession,
  clearReflectionSessionSelection,
  createReflectionSession,
  getReflectionSessionResult,
  getReflectionSessionStock,
  type ReflectionSelection,
  type ReflectionSession,
  type ReflectionSessionResult,
  removeReflectionSessionPiece,
  restartReflectionSession,
  tapReflectionSessionCell,
  tapReflectionSessionClue,
  tapReflectionSessionStock,
} from "@/games/reflection/session/session";
import { calculateTimeDeltaMs, type SpeedScoreRule } from "@/games/score";

/** 表示中の光路。今の盤面で、外周の `entry` から入れた光がどう進むか。 */
export type ReflectionLaserView = {
  entry: ReflectionEntry;
  trace: ReflectionLaserTrace;
};

/** クリアしたプレイの事実と、それを遊んだ問題の作業の量から導いた評価。 */
export type ReflectionResult = ReflectionSessionResult & {
  workload: ReflectionSolveWorkload;
  speedRule: SpeedScoreRule;
  timeDeltaMs: number;
  score: ReflectionPlayScore;
};

export type ReflectionPlay = GamePlay<
  ReflectionDifficulty,
  ReflectionProblemIdentity,
  ReflectionSession,
  ReflectionResult
> &
  RestartableGamePlay & {
    poolReference: ReflectionProblemPoolReference;
    board: ReflectionBoard;
    clues: readonly ReflectionClue[];
    inventory: ReflectionInventory;
    stock: ReflectionInventory;
    selection: ReflectionSelection | null;
    laser: ReflectionLaserView | null;
    tapStock: (piece: ReflectionPiece) => void;
    tapCell: (cellIndex: number) => void;
    tapClue: (entry: ReflectionEntry) => void;
    removePiece: (cellIndex: number) => void;
    clearSelection: () => void;
  };

type ReflectionPlayState = {
  session: ReflectionSession;
  progress: GameProgress;
  problemIdentity: ReflectionProblemIdentity;
  poolReference: ReflectionProblemPoolReference;
  workload: ReflectionSolveWorkload;
};

function createPlayState(
  { problem, identity, poolReference, workload }: ReflectionPooledProblem,
  startedAt: number,
): ReflectionPlayState {
  return {
    session: createReflectionSession(problem, startedAt),
    progress: "playing",
    problemIdentity: identity,
    poolReference,
    workload,
  };
}

function selectProblem(
  difficulty: ReflectionDifficulty,
  avoidedProblemId: ProblemId | undefined,
): ReflectionPooledProblem {
  return selectProblemAvoiding(
    (seed) => selectReflectionProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

/** 完了したプレイの事実から結果を作る。プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createReflectionResult(
  sessionResult: ReflectionSessionResult,
  workload: ReflectionSolveWorkload,
): ReflectionResult {
  const speedRule = calculateReflectionSpeedScoreRule(workload);
  return {
    ...sessionResult,
    workload,
    speedRule,
    timeDeltaMs: calculateTimeDeltaMs(sessionResult.elapsedMs, speedRule),
    score: calculateReflectionPlayScore({
      elapsedMs: sessionResult.elapsedMs,
      workload,
    }),
  };
}

/**
 * 難易度のプレイを始める。`initialProblem` を渡すと、最初の1問だけその問題を出す。
 * 渡さなければ、最初の1問は `avoidedProblemId` の問題を避けて選ぶ。
 * `tapClue` は外周ヒントの光路を表示し、盤面が揃うと `progress` が `clearing` になる。
 * クリアすると `result` に評価を返す。
 */
export function useReflectionPlay(
  difficulty: ReflectionDifficulty,
  initialProblem?: ReflectionPooledProblem,
  avoidedProblemId?: ProblemId,
): ReflectionPlay {
  const [play, setPlay] = useState<ReflectionPlayState>(() =>
    createPlayState(
      initialProblem ?? selectProblem(difficulty, avoidedProblemId),
      Date.now(),
    ),
  );
  const { session, progress, problemIdentity, workload } = play;
  const elapsedMs = useSessionElapsedMs(session);

  const updateSession = useCallback(
    (update: (current: ReflectionSession) => ReflectionSession) => {
      setPlay((current) => applyPlaySession(current, update(current.session)));
    },
    [],
  );

  const tapStock = useCallback(
    (piece: ReflectionPiece) => {
      const operatedAt = Date.now();
      updateSession((current) =>
        tapReflectionSessionStock(current, piece, operatedAt),
      );
    },
    [updateSession],
  );

  const tapCell = useCallback(
    (cellIndex: number) => {
      const operatedAt = Date.now();
      updateSession((current) =>
        tapReflectionSessionCell(current, cellIndex, operatedAt),
      );
    },
    [updateSession],
  );

  const tapClue = useCallback(
    (entry: ReflectionEntry) => {
      updateSession((current) => tapReflectionSessionClue(current, entry));
    },
    [updateSession],
  );

  const removePiece = useCallback(
    (cellIndex: number) => {
      const operatedAt = Date.now();
      updateSession((current) =>
        removeReflectionSessionPiece(current, cellIndex, operatedAt),
      );
    },
    [updateSession],
  );

  const clearSelection = useCallback(() => {
    updateSession(clearReflectionSessionSelection);
  }, [updateSession]);

  const restart = useCallback(() => {
    updateSession(restartReflectionSession);
  }, [updateSession]);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) =>
      startPlaySession(
        current,
        createReflectionSession(current.session.problem, startedAt),
      ),
    );
  }, []);

  const completeClearAnimation = useCallback(() => {
    setPlay(completePlayClearAnimation);
  }, []);

  const startNewProblem = useCallback(() => {
    setPlay(
      createPlayState(
        selectProblem(difficulty, createProblemId(problemIdentity)),
        Date.now(),
      ),
    );
  }, [difficulty, problemIdentity]);

  const stock = useMemo(() => getReflectionSessionStock(session), [session]);
  const result = useMemo(() => {
    const sessionResult = getReflectionSessionResult(session);
    return sessionResult
      ? createReflectionResult(sessionResult, workload)
      : null;
  }, [session, workload]);
  const laser = useMemo<ReflectionLaserView | null>(() => {
    const entry = session.laserEntry;
    return entry
      ? { entry, trace: traceReflectionLaser(session.puzzleState, entry) }
      : null;
  }, [session.laserEntry, session.puzzleState]);

  return {
    difficulty,
    problemIdentity,
    session,
    status: session.status,
    progress,
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
    elapsedMs,
    result,
    poolReference: play.poolReference,
    board: session.puzzleState,
    clues: session.problem.clues,
    inventory: session.problem.inventory,
    stock,
    selection: session.selection,
    laser,
    canRestart: canRestartReflectionSession(session),
    tapStock,
    tapCell,
    tapClue,
    removePiece,
    clearSelection,
    restart,
    replay,
    completeClearAnimation,
    startNewProblem,
  };
}
