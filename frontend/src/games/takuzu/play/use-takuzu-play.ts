import { useCallback, useMemo, useState } from "react";

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
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import type {
  TakuzuProblemIdentity,
  TakuzuSolveWorkload,
} from "@/games/takuzu/problem/problem";
import type { TakuzuPooledProblem } from "@/games/takuzu/problem/problem-pool";
import { selectTakuzuProblemForDifficulty } from "@/games/takuzu/problem-selection";
import type { TakuzuCell } from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import {
  calculateTakuzuPlayScore,
  calculateTakuzuSpeedScoreRule,
  type TakuzuPlayScore,
} from "@/games/takuzu/score";
import {
  canRestartTakuzuSession,
  canUndoTakuzuSession,
  createTakuzuSession,
  cycleTakuzuSessionCell,
  getTakuzuSessionCellViews,
  getTakuzuSessionCorrectionCount,
  getTakuzuSessionLineViolations,
  getTakuzuSessionResult,
  placeTakuzuSessionCell,
  restartTakuzuSession,
  type TakuzuCellView,
  type TakuzuLineViolationView,
  type TakuzuSession,
  type TakuzuSessionResult,
  undoTakuzuSession,
} from "@/games/takuzu/session/session";

/** クリアしたプレイの事実と、それを遊んだ問題の作業の量から導いた評価。 */
export type TakuzuResult = TakuzuSessionResult & {
  workload: TakuzuSolveWorkload;
  speedRule: SpeedScoreRule;
  timeDeltaMs: number;
  score: TakuzuPlayScore;
};

/** 完了したプレイの事実から結果を作る。プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createTakuzuResult(
  sessionResult: TakuzuSessionResult,
  workload: TakuzuSolveWorkload,
): TakuzuResult {
  const speedRule = calculateTakuzuSpeedScoreRule(workload);
  return {
    ...sessionResult,
    workload,
    speedRule,
    timeDeltaMs: calculateTimeDeltaMs(sessionResult.elapsedMs, speedRule),
    score: calculateTakuzuPlayScore({ ...sessionResult, workload }),
  };
}

export type TakuzuPlay = GamePlay<
  TakuzuDifficulty,
  TakuzuProblemIdentity,
  TakuzuSession,
  TakuzuResult
> &
  RestartableGamePlay &
  UndoableGamePlay & {
    size: number;
    cells: TakuzuCellView[];
    lineViolations: TakuzuLineViolationView[];
    correctionCount: number;
    undoCount: number;
    cycleCell: (cellIndex: number, direction: TakuzuCycleDirection) => void;
    placeCell: (cellIndex: number, cell: TakuzuCell) => void;
  };

type TakuzuPlayState = {
  problemIdentity: TakuzuProblemIdentity;
  workload: TakuzuSolveWorkload;
  session: TakuzuSession;
  progress: GameProgress;
};

function createPlayState(
  { problem, identity, workload }: TakuzuPooledProblem,
  startedAt: number,
): TakuzuPlayState {
  return {
    problemIdentity: identity,
    workload,
    session: createTakuzuSession(problem, startedAt),
    progress: "playing",
  };
}

function selectProblem(
  difficulty: TakuzuDifficulty,
  avoidedProblemId: ProblemId | undefined,
): TakuzuPooledProblem {
  return selectProblemAvoiding(
    (seed) => selectTakuzuProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

/**
 * 難易度の問題集から選んだ問題を遊ぶ。
 * `initialProblem` を渡すと、その問題で始める。渡さなければ `avoidedProblemId` の問題を避けて選ぶ。
 * 問題集から引けない記録を再プレイできないものとして呼び出し側で扱えるよう、identity ではなく引いた問題を受け取る。
 */
export function useTakuzuPlay(
  difficulty: TakuzuDifficulty,
  initialProblem?: TakuzuPooledProblem,
  avoidedProblemId?: ProblemId,
): TakuzuPlay {
  const [play, setPlay] = useState(() =>
    createPlayState(
      initialProblem ?? selectProblem(difficulty, avoidedProblemId),
      Date.now(),
    ),
  );
  const { session, progress, problemIdentity, workload } = play;
  const elapsedMs = useSessionElapsedMs(session);

  const cycleCell = useCallback(
    (cellIndex: number, direction: TakuzuCycleDirection) => {
      const operatedAt = Date.now();
      setPlay((current) =>
        applyPlaySession(
          current,
          cycleTakuzuSessionCell(
            current.session,
            cellIndex,
            direction,
            operatedAt,
          ),
        ),
      );
    },
    [],
  );

  const placeCell = useCallback((cellIndex: number, cell: TakuzuCell) => {
    const operatedAt = Date.now();
    setPlay((current) =>
      applyPlaySession(
        current,
        placeTakuzuSessionCell(current.session, cellIndex, cell, operatedAt),
      ),
    );
  }, []);

  const undo = useCallback(() => {
    setPlay((current) =>
      applyPlaySession(current, undoTakuzuSession(current.session)),
    );
  }, []);

  const restart = useCallback(() => {
    setPlay((current) =>
      applyPlaySession(current, restartTakuzuSession(current.session)),
    );
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) =>
      startPlaySession(
        current,
        createTakuzuSession(current.session.problem, startedAt),
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

  const cells = useMemo(() => getTakuzuSessionCellViews(session), [session]);
  const lineViolations = useMemo(
    () => getTakuzuSessionLineViolations(session),
    [session],
  );

  const result = useMemo(() => {
    const sessionResult = getTakuzuSessionResult(session);
    return sessionResult ? createTakuzuResult(sessionResult, workload) : null;
  }, [session, workload]);

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
    size: session.puzzleState.size,
    cells,
    lineViolations,
    correctionCount: getTakuzuSessionCorrectionCount(session),
    undoCount: session.undoCount,
    canUndo: canUndoTakuzuSession(session),
    canRestart: canRestartTakuzuSession(session),
    cycleCell,
    placeCell,
    undo,
    restart,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}
