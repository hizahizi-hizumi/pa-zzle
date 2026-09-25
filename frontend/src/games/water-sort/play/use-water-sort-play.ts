import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createProblemSeed, type ProblemSeed } from "@/games/problem-seed";
import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import { restoreWaterSortProblem } from "@/games/water-sort/problem/generator";
import type {
  WaterSortGeneratedProblem,
  WaterSortProblemIdentity,
} from "@/games/water-sort/problem/problem";
import { selectWaterSortProblemForDifficulty } from "@/games/water-sort/problem-selection";
import { classifyWaterSortDeadlock } from "@/games/water-sort/puzzle/deadlock";
import {
  isCompleteWaterSortBottle,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";
import {
  calculateWaterSortPerformanceComparison,
  calculateWaterSortPlayScore,
  type WaterSortPlayScore,
} from "@/games/water-sort/score";
import {
  applyWaterSortSessionMove,
  canUndoWaterSortSession,
  createWaterSortSession,
  getWaterSortSessionElapsedMs,
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

export type WaterSortProgress = "playing" | "clearing" | "result";
export type WaterSortResult = WaterSortSessionResult & {
  optimalMoveCount: number;
  moveDelta: number;
  timeDeltaMs: number;
  backtrackMoveCount: number;
  speedFullScoreMs: number;
  colorCount: number;
  score: WaterSortPlayScore;
};

type WaterSortPlayState = {
  session: WaterSortSession;
  sourceBottleIndex: number | null;
  problemIdentity: WaterSortProblemIdentity;
  optimalMoveCount: number;
  progress: WaterSortProgress;
  operation: WaterSortOperation | null;
};

function generateProblem(
  difficulty: WaterSortDifficulty,
  seed: ProblemSeed,
): WaterSortGeneratedProblem {
  return selectWaterSortProblemForDifficulty(difficulty, seed);
}

function createPlayState(
  difficulty: WaterSortDifficulty,
  seed: ProblemSeed,
  startedAt: number,
  initialProblemIdentity?: WaterSortProblemIdentity,
): WaterSortPlayState {
  const generatedProblem = initialProblemIdentity
    ? restoreWaterSortProblem(initialProblemIdentity)
    : generateProblem(difficulty, seed);

  return {
    session: createWaterSortSession(generatedProblem.problem, startedAt),
    problemIdentity: generatedProblem.identity,
    optimalMoveCount: generatedProblem.optimalMoveCount,
    sourceBottleIndex: null,
    progress: "playing",
    operation: null,
  };
}

export function useWaterSortPlay(
  difficulty: WaterSortDifficulty,
  initialProblemIdentity?: WaterSortProblemIdentity,
) {
  const [play, setPlay] = useState<WaterSortPlayState>(() =>
    createPlayState(
      difficulty,
      initialProblemIdentity?.seed ?? createProblemSeed(),
      Date.now(),
      initialProblemIdentity,
    ),
  );
  const [now, setNow] = useState(() => Date.now());
  const nextOperationId = useRef(0);

  useEffect(() => {
    if (play.session.status !== "playing") {
      return;
    }

    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [play.session.status]);

  const selectBottle = useCallback((bottleIndex: number) => {
    const selectedAt = Date.now();
    const operationId = nextOperationId.current++;
    setNow(selectedAt);
    setPlay((current) => {
      const { session } = current;
      if (current.progress !== "playing" || !session.state[bottleIndex]) {
        return current;
      }

      if (current.sourceBottleIndex === null) {
        const bottle = session.state[bottleIndex];
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
      if (!nextSession) {
        return {
          ...current,
          operation: { id: operationId, type: "invalid", bottleIndex },
        };
      }

      const cleared = nextSession.status === "cleared";
      return {
        ...current,
        session: nextSession,
        progress: cleared ? "clearing" : "playing",
        sourceBottleIndex: null,
        operation: {
          id: operationId,
          type: "poured",
          sourceBottleIndex,
          destinationBottleIndex: bottleIndex,
          stateBefore: session.state,
          stateAfter: nextSession.state,
          isClearingMove: cleared,
        },
      };
    });
  }, []);

  const undo = useCallback(() => {
    setPlay((current) => {
      const session = undoWaterSortSession(current.session);
      if (session === current.session) {
        return current;
      }

      return {
        ...current,
        session,
        sourceBottleIndex: null,
        operation: null,
      };
    });
  }, []);

  const restart = useCallback(() => {
    const restartedAt = Date.now();
    setNow(restartedAt);
    setPlay((current) => ({
      ...current,
      session: restartWaterSortSession(current.session),
      sourceBottleIndex: null,
      progress: "playing",
      operation: null,
    }));
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setPlay((current) => ({
      ...current,
      session: createWaterSortSession(current.session.problem, startedAt),
      sourceBottleIndex: null,
      progress: "playing",
      operation: null,
    }));
  }, []);

  const startNewProblem = useCallback(() => {
    const startedAt = Date.now();
    const next = createPlayState(difficulty, createProblemSeed(), startedAt);
    setNow(startedAt);
    setPlay(next);
  }, [difficulty]);

  const completeClearingPour = useCallback(() => {
    setPlay((current) =>
      current.progress === "clearing"
        ? { ...current, progress: "result", operation: null }
        : current,
    );
  }, []);

  const { session } = play;
  const elapsedMs = getWaterSortSessionElapsedMs(session, now);
  const optimalMoveCount = play.optimalMoveCount;
  const isDeadlocked = useMemo(
    () =>
      play.progress === "playing" &&
      classifyWaterSortDeadlock(session.state) === "deadlocked",
    [play.progress, session.state],
  );
  const sessionResult = useMemo(
    () => getWaterSortSessionResult(session, now),
    [now, session],
  );
  const result = useMemo<WaterSortResult | null>(() => {
    if (!sessionResult) {
      return null;
    }

    const colorCount = play.problemIdentity.conditions.colorCount;
    const comparison = calculateWaterSortPerformanceComparison({
      elapsedMs: sessionResult.elapsedMs,
      completionMoveCount: sessionResult.completionMoveCount,
      optimalMoveCount,
      colorCount,
    });

    return {
      ...sessionResult,
      optimalMoveCount,
      moveDelta: comparison.moveDelta,
      timeDeltaMs: comparison.timeDeltaMs,
      backtrackMoveCount:
        sessionResult.moveCount - sessionResult.completionMoveCount,
      speedFullScoreMs: comparison.speedFullScoreMs,
      colorCount,
      score: calculateWaterSortPlayScore({
        elapsedMs: sessionResult.elapsedMs,
        moveCount: sessionResult.moveCount,
        completionMoveCount: sessionResult.completionMoveCount,
        optimalMoveCount,
        colorCount,
      }),
    };
  }, [
    optimalMoveCount,
    play.problemIdentity.conditions.colorCount,
    sessionResult,
  ]);

  const problemIdentity = play.problemIdentity;

  return {
    difficulty,
    seed: problemIdentity.seed,
    problemIdentity,
    status: session.status,
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
    progress: play.progress,
    state: session.state,
    elapsedMs,
    moveCount: session.moveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    optimalMoveCount,
    canUndo: play.progress === "playing" && canUndoWaterSortSession(session),
    isDeadlocked,
    sourceBottleIndex: play.sourceBottleIndex,
    operation: play.operation,
    result,
    selectBottle,
    undo,
    restart,
    replay,
    startNewProblem,
    completeClearingPour,
  };
}
