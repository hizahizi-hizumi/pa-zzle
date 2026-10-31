import { useCallback, useMemo, useRef, useState } from "react";

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
import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import type { WaterSortProblemIdentity } from "@/games/water-sort/problem/problem";
import type { WaterSortPooledProblem } from "@/games/water-sort/problem/problem-pool";
import { selectWaterSortProblemForDifficulty } from "@/games/water-sort/problem-selection";
import { classifyWaterSortDeadlock } from "@/games/water-sort/puzzle/deadlock";
import {
  isCompleteWaterSortBottle,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";
import {
  calculateWaterSortMoveDelta,
  calculateWaterSortPlayScore,
  calculateWaterSortSpeedScoreRule,
  type WaterSortPlayScore,
} from "@/games/water-sort/score";
import {
  applyWaterSortSessionMove,
  canRestartWaterSortSession,
  canUndoWaterSortSession,
  createWaterSortSession,
  getWaterSortSessionResult,
  listWaterSortSessionLegalMoves,
  restartWaterSortSession,
  undoWaterSortSession,
  type WaterSortSession,
  type WaterSortSessionResult,
} from "@/games/water-sort/session/session";

export type WaterSortOperation =
  | {
      id: number;
      type: "source-selected" | "source-deselected";
      bottleIndex: number;
    }
  | { id: number; type: "invalid"; bottleIndex: number }
  | {
      id: number;
      type: "poured";
      sourceBottleIndex: number;
      destinationBottleIndex: number;
      stateBefore: WaterSortState;
      stateAfter: WaterSortState;
      isClearingMove: boolean;
    };

export type WaterSortResult = WaterSortSessionResult & {
  optimalMoveCount: number;
  moveDelta: number;
  speedRule: SpeedScoreRule;
  timeDeltaMs: number;
  backtrackMoveCount: number;
  colorCount: number;
  score: WaterSortPlayScore;
};

/** 完了したプレイの事実から結果を作る。プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createWaterSortResult(
  sessionResult: WaterSortSessionResult,
  optimalMoveCount: number,
  colorCount: number,
): WaterSortResult {
  const speedRule = calculateWaterSortSpeedScoreRule({
    optimalMoveCount,
    colorCount,
  });

  return {
    ...sessionResult,
    optimalMoveCount,
    moveDelta: calculateWaterSortMoveDelta({
      completionMoveCount: sessionResult.completionMoveCount,
      optimalMoveCount,
    }),
    speedRule,
    timeDeltaMs: calculateTimeDeltaMs(sessionResult.elapsedMs, speedRule),
    backtrackMoveCount:
      sessionResult.moveCount - sessionResult.completionMoveCount,
    colorCount,
    score: calculateWaterSortPlayScore({
      elapsedMs: sessionResult.elapsedMs,
      moveCount: sessionResult.moveCount,
      completionMoveCount: sessionResult.completionMoveCount,
      optimalMoveCount,
      colorCount,
    }),
  };
}

export type WaterSortPlay = GamePlay<
  WaterSortDifficulty,
  WaterSortProblemIdentity,
  WaterSortSession,
  WaterSortResult
> &
  RestartableGamePlay &
  UndoableGamePlay & {
    state: WaterSortState;
    moveCount: number;
    undoCount: number;
    restartCount: number;
    optimalMoveCount: number;
    isDeadlocked: boolean;
    sourceBottleIndex: number | null;
    operation: WaterSortOperation | null;
    selectBottle: (bottleIndex: number) => void;
  };

type WaterSortPlayState = {
  session: WaterSortSession;
  sourceBottleIndex: number | null;
  problemIdentity: WaterSortProblemIdentity;
  optimalMoveCount: number;
  progress: GameProgress;
  operation: WaterSortOperation | null;
};

function createPlayState(
  { problem, identity, optimalMoveCount }: WaterSortPooledProblem,
  startedAt: number,
): WaterSortPlayState {
  return {
    session: createWaterSortSession(problem, startedAt),
    problemIdentity: identity,
    optimalMoveCount,
    sourceBottleIndex: null,
    progress: "playing",
    operation: null,
  };
}

function selectProblem(
  difficulty: WaterSortDifficulty,
  avoidedProblemId: ProblemId | undefined,
): WaterSortPooledProblem {
  return selectProblemAvoiding(
    (seed) => selectWaterSortProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

/** `initialProblem` を渡すと、その問題で始める。渡さなければ `avoidedProblemId` の問題を避けて選ぶ。 */
export function useWaterSortPlay(
  difficulty: WaterSortDifficulty,
  initialProblem?: WaterSortPooledProblem,
  avoidedProblemId?: ProblemId,
): WaterSortPlay {
  const [play, setPlay] = useState<WaterSortPlayState>(() =>
    createPlayState(
      initialProblem ?? selectProblem(difficulty, avoidedProblemId),
      Date.now(),
    ),
  );
  const { session, problemIdentity, optimalMoveCount } = play;
  const elapsedMs = useSessionElapsedMs(session);
  const nextOperationId = useRef(0);

  const selectBottle = useCallback((bottleIndex: number) => {
    const selectedAt = Date.now();
    const operationId = nextOperationId.current++;
    setPlay((current) => {
      const { session } = current;
      if (current.progress !== "playing" || !session.puzzleState[bottleIndex]) {
        return current;
      }

      if (current.sourceBottleIndex === null) {
        const bottle = session.puzzleState[bottleIndex];
        const hasLegalMove = listWaterSortSessionLegalMoves(session).some(
          (move) => move.sourceBottleIndex === bottleIndex,
        );
        if (!bottle || isCompleteWaterSortBottle(bottle) || !hasLegalMove) {
          return {
            ...current,
            operation: { id: operationId, type: "invalid", bottleIndex },
          };
        }

        return {
          ...current,
          sourceBottleIndex: bottleIndex,
          operation: {
            id: operationId,
            type: "source-selected",
            bottleIndex,
          },
        };
      }

      if (current.sourceBottleIndex === bottleIndex) {
        return {
          ...current,
          sourceBottleIndex: null,
          operation: {
            id: operationId,
            type: "source-deselected",
            bottleIndex,
          },
        };
      }

      const sourceBottleIndex = current.sourceBottleIndex;
      const nextSession = applyWaterSortSessionMove(
        session,
        {
          sourceBottleIndex,
          destinationBottleIndex: bottleIndex,
        },
        selectedAt,
      );
      if (nextSession === session) {
        return {
          ...current,
          operation: { id: operationId, type: "invalid", bottleIndex },
        };
      }

      return {
        ...applyPlaySession(current, nextSession),
        sourceBottleIndex: null,
        operation: {
          id: operationId,
          type: "poured",
          sourceBottleIndex,
          destinationBottleIndex: bottleIndex,
          stateBefore: session.puzzleState,
          stateAfter: nextSession.puzzleState,
          isClearingMove: nextSession.status === "cleared",
        },
      };
    });
  }, []);

  const undo = useCallback(() => {
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        undoWaterSortSession(current.session),
      );
      return next === current
        ? current
        : { ...next, sourceBottleIndex: null, operation: null };
    });
  }, []);

  const restart = useCallback(() => {
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        restartWaterSortSession(current.session),
      );
      return next === current
        ? current
        : { ...next, sourceBottleIndex: null, operation: null };
    });
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) => ({
      ...startPlaySession(
        current,
        createWaterSortSession(current.session.problem, startedAt),
      ),
      sourceBottleIndex: null,
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
    setPlay((current) => {
      const next = completePlayClearAnimation(current);
      return next === current ? current : { ...next, operation: null };
    });
  }, []);

  const isDeadlocked = useMemo(
    () =>
      session.status === "playing" &&
      classifyWaterSortDeadlock(session.puzzleState) === "deadlocked",
    [session.status, session.puzzleState],
  );
  const colorCount = problemIdentity.conditions.colorCount;
  const result = useMemo(() => {
    const sessionResult = getWaterSortSessionResult(session);
    return sessionResult
      ? createWaterSortResult(sessionResult, optimalMoveCount, colorCount)
      : null;
  }, [colorCount, optimalMoveCount, session]);

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
    state: session.puzzleState,
    moveCount: session.moveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    optimalMoveCount,
    canUndo: canUndoWaterSortSession(session),
    canRestart: canRestartWaterSortSession(session),
    isDeadlocked,
    sourceBottleIndex: play.sourceBottleIndex,
    operation: play.operation,
    selectBottle,
    undo,
    restart,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}
