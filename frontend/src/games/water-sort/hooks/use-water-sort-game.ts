import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createSeed, type Seed } from "@/games/core/seed";
import {
  assessWaterSortDifficulty,
  type WaterSortDifficulty,
} from "@/games/water-sort/game/difficulty";
import type { WaterSortProblem } from "@/games/water-sort/game/generator";
import { generateWaterSortProblemForDifficulty } from "@/games/water-sort/game/problem-selection";
import { calculateWaterSortPlayScore } from "@/games/water-sort/game/performance";
import {
  applyWaterSortMove,
  listWaterSortLegalMoves,
} from "@/games/water-sort/game/rules";
import {
  isCompleteWaterSortBottle,
  isWaterSortCleared,
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

export type WaterSortResult = {
  elapsedMs: number;
  moveCount: number;
  undoCount: number;
  restartCount: number;
  optimalMoveCount: number;
  moveDelta: number;
  score: number;
};

type WaterSortPlayState = {
  status: "playing" | "cleared";
  problem: WaterSortProblem;
  state: WaterSortState;
  history: readonly WaterSortState[];
  startedAt: number;
  finishedAt: number | null;
  moveCount: number;
  undoCount: number;
  restartCount: number;
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

function createPlayState(
  difficulty: WaterSortDifficulty,
  seed: Seed,
  startedAt = Date.now(),
): WaterSortPlayState {
  const problem = generateProblem(difficulty, seed);

  return {
    status: "playing",
    problem,
    state: problem.initialState,
    history: [],
    startedAt,
    finishedAt: null,
    moveCount: 0,
    undoCount: 0,
    restartCount: 0,
    sourceBottleIndex: null,
    progress: "playing",
    operation: null,
  };
}

export function useWaterSortGame(difficulty: WaterSortDifficulty) {
  const [play, setPlay] = useState<WaterSortPlayState>(() =>
    createPlayState(difficulty, createSeed()),
  );
  const [now, setNow] = useState(() => Date.now());
  const nextOperationId = useRef(0);

  useEffect(() => {
    if (play.status !== "playing") {
      return;
    }

    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [play.status]);

  const selectBottle = useCallback((bottleIndex: number) => {
    const selectedAt = Date.now();
    const operationId = nextOperationId.current++;
    setNow(selectedAt);
    setPlay((current) => {
      if (current.progress !== "playing" || !current.state[bottleIndex]) {
        return current;
      }

      if (current.sourceBottleIndex === null) {
        const bottle = current.state[bottleIndex];
        const hasLegalMove = listWaterSortLegalMoves(current.state).some(
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
      const nextState = applyWaterSortMove(current.state, {
        sourceBottleIndex,
        destinationBottleIndex: bottleIndex,
      });
      if (!nextState) {
        return {
          ...current,
          operation: { id: operationId, type: "invalid", bottleIndex },
        };
      }

      const cleared = isWaterSortCleared(nextState);
      return {
        ...current,
        status: cleared ? "cleared" : "playing",
        progress: cleared ? "clearing" : "playing",
        state: nextState,
        history: [...current.history, current.state],
        finishedAt: cleared ? selectedAt : null,
        moveCount: current.moveCount + 1,
        sourceBottleIndex: null,
        operation: {
          id: operationId,
          type: "poured",
          sourceBottleIndex,
          destinationBottleIndex: bottleIndex,
          stateBefore: current.state,
          stateAfter: nextState,
          isClearingMove: cleared,
        },
      };
    });
  }, []);

  const undo = useCallback(() => {
    setPlay((current) => {
      if (current.status !== "playing") {
        return current;
      }

      const previousState = current.history.at(-1);
      if (!previousState) {
        return current;
      }

      return {
        ...current,
        state: previousState,
        history: current.history.slice(0, -1),
        undoCount: current.undoCount + 1,
        sourceBottleIndex: null,
        operation: null,
      };
    });
  }, []);

  const restart = useCallback(() => {
    const restartedAt = Date.now();
    setNow(restartedAt);
    setPlay((current) => {
      if (current.status === "cleared") {
        return createPlayState(difficulty, current.problem.seed, restartedAt);
      }

      return {
        ...current,
        state: current.problem.initialState,
        history: [],
        restartCount: current.restartCount + 1,
        sourceBottleIndex: null,
        progress: "playing",
        operation: null,
      };
    });
  }, [difficulty]);

  const newGame = useCallback(() => {
    const next = createPlayState(difficulty, createSeed());
    setNow(next.startedAt);
    setPlay(next);
  }, [difficulty]);

  const completeClearingPour = useCallback(() => {
    setPlay((current) =>
      current.progress === "clearing"
        ? { ...current, progress: "result", operation: null }
        : current,
    );
  }, []);

  const elapsedMs = Math.max(0, (play.finishedAt ?? now) - play.startedAt);
  const optimalMoveCount = play.problem.solutionMoves.length;
  const problemDifficulty = assessWaterSortDifficulty(
    play.problem.difficultyAnalysis,
  );
  const result = useMemo<WaterSortResult | null>(() => {
    if (play.status !== "cleared") {
      return null;
    }

    return {
      elapsedMs,
      moveCount: play.moveCount,
      undoCount: play.undoCount,
      restartCount: play.restartCount,
      optimalMoveCount,
      moveDelta: play.moveCount - optimalMoveCount,
      score: calculateWaterSortPlayScore(play.moveCount, optimalMoveCount),
    };
  }, [
    elapsedMs,
    optimalMoveCount,
    play.moveCount,
    play.restartCount,
    play.status,
    play.undoCount,
  ]);

  return {
    difficulty,
    seed: play.problem.seed,
    status: play.status,
    progress: play.progress,
    state: play.state,
    elapsedMs,
    moveCount: play.moveCount,
    undoCount: play.undoCount,
    restartCount: play.restartCount,
    optimalMoveCount,
    problemDifficulty,
    canUndo: play.progress === "playing" && play.history.length > 0,
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
