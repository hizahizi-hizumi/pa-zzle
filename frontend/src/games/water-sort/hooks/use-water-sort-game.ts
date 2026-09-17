import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createSeed, type Seed } from "@/games/core/seed";
import { classifyWaterSortDeadlock } from "@/games/water-sort/game/deadlock";
import {
  assessWaterSortDifficulty,
  type WaterSortDifficulty,
} from "@/games/water-sort/game/difficulty";
import type { WaterSortProblem } from "@/games/water-sort/game/generator";
import { generateWaterSortProblemForDifficulty } from "@/games/water-sort/game/problem-selection";
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
} from "@/games/water-sort/game/session";
import {
  isCompleteWaterSortBottle,
  type WaterSortState,
} from "@/games/water-sort/game/state";

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
export type WaterSortResult = WaterSortSessionResult;

type WaterSortReactState = {
  session: WaterSortSession;
  sourceBottleIndex: number | null;
  progress: WaterSortProgress;
  operation: WaterSortOperation | null;
};

function generateProblem(
  difficulty: WaterSortDifficulty,
  seed: Seed,
): WaterSortProblem {
  return generateWaterSortProblemForDifficulty(difficulty, seed);
}

function createReactState(
  difficulty: WaterSortDifficulty,
  seed: Seed,
  startedAt: number,
): WaterSortReactState {
  const problem = generateProblem(difficulty, seed);

  return {
    session: createWaterSortSession(problem, startedAt),
    sourceBottleIndex: null,
    progress: "playing",
    operation: null,
  };
}

export function useWaterSortGame(difficulty: WaterSortDifficulty) {
  const [play, setPlay] = useState<WaterSortReactState>(() =>
    createReactState(difficulty, createSeed(), Date.now()),
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
      session: restartWaterSortSession(current.session, restartedAt),
      sourceBottleIndex: null,
      progress: "playing",
      operation: null,
    }));
  }, []);

  const newGame = useCallback(() => {
    const startedAt = Date.now();
    const next = createReactState(difficulty, createSeed(), startedAt);
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
  const optimalMoveCount = session.problem.solutionMoves.length;
  const isDeadlocked = useMemo(
    () =>
      play.progress === "playing" &&
      classifyWaterSortDeadlock(session.state) === "deadlocked",
    [play.progress, session.state],
  );
  const problemDifficulty = assessWaterSortDifficulty(
    session.problem.difficultyAnalysis,
  );
  const result = useMemo(
    () => getWaterSortSessionResult(session, now),
    [now, session],
  );

  return {
    difficulty,
    seed: session.problem.seed,
    status: session.status,
    progress: play.progress,
    state: session.state,
    elapsedMs,
    moveCount: session.moveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    optimalMoveCount,
    problemDifficulty,
    canUndo: play.progress === "playing" && canUndoWaterSortSession(session),
    isDeadlocked,
    sourceBottleIndex: play.sourceBottleIndex,
    operation: play.operation,
    result,
    selectBottle,
    undo,
    restart,
    newGame,
    completeClearingPour,
  };
}
