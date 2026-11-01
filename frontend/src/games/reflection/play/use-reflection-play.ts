import { useCallback, useMemo, useRef, useState } from "react";

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

/**
 * ピースを盤面に置いた操作の知らせ。効果音を鳴らすため、操作ごとに増える `id` を付ける。
 * 手持ちのピースを置く、盤面のピースを別のマスへ移す・入れ替える・別の種類で置き換えるときに知らせる。
 * 選択とその解除、手持ちへ戻す、光路の表示、盤面を戻す・リセットでは知らせない。
 */
export type ReflectionOperation = { id: number; type: "piece-placed" };

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
    operation: ReflectionOperation | null;
    selectStockPiece: (piece: ReflectionPiece) => void;
    selectCell: (cellIndex: number) => void;
    selectClue: (entry: ReflectionEntry) => void;
    removePiece: (cellIndex: number) => void;
    clearSelection: () => void;
  };

type ReflectionPlayState = {
  session: ReflectionSession;
  progress: GameProgress;
  problemIdentity: ReflectionProblemIdentity;
  poolReference: ReflectionProblemPoolReference;
  workload: ReflectionSolveWorkload;
  operation: ReflectionOperation | null;
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
    operation: null,
  };
}

function countPlacedPieces(board: ReflectionBoard): number {
  return board.cells.filter((cell) => cell !== null).length;
}

/** 操作の前後の session から、ピースを盤面に置いた操作なら知らせる。盤面のピースが減った操作は手持ちへ戻す操作なので知らせない。 */
function createOperation(
  id: number,
  previous: ReflectionSession,
  next: ReflectionSession,
): ReflectionOperation | null {
  if (
    next.puzzleState === previous.puzzleState ||
    countPlacedPieces(next.puzzleState) <
      countPlacedPieces(previous.puzzleState)
  ) {
    return null;
  }
  return { id, type: "piece-placed" };
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
 * `selectClue` は外周ヒントの光路を表示し、盤面が揃うと `progress` が `clearing` になる。
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
  const nextOperationId = useRef(0);

  const updateSession = useCallback(
    (update: (current: ReflectionSession) => ReflectionSession) => {
      const operationId = nextOperationId.current++;
      setPlay((current) => {
        const next = applyPlaySession(current, update(current.session));
        return next === current
          ? current
          : {
              ...next,
              operation: createOperation(
                operationId,
                current.session,
                next.session,
              ),
            };
      });
    },
    [],
  );

  const selectStockPiece = useCallback(
    (piece: ReflectionPiece) => {
      const operatedAt = Date.now();
      updateSession((current) =>
        tapReflectionSessionStock(current, piece, operatedAt),
      );
    },
    [updateSession],
  );

  const selectCell = useCallback(
    (cellIndex: number) => {
      const operatedAt = Date.now();
      updateSession((current) =>
        tapReflectionSessionCell(current, cellIndex, operatedAt),
      );
    },
    [updateSession],
  );

  const selectClue = useCallback(
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
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        restartReflectionSession(current.session),
      );
      return next === current ? current : { ...next, operation: null };
    });
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) => ({
      ...startPlaySession(
        current,
        createReflectionSession(current.session.problem, startedAt),
      ),
      operation: null,
    }));
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
    operation: play.operation,
    canRestart: canRestartReflectionSession(session),
    selectStockPiece,
    selectCell,
    selectClue,
    removePiece,
    clearSelection,
    restart,
    replay,
    completeClearAnimation,
    startNewProblem,
  };
}
