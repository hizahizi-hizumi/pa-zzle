import { useCallback, useEffect, useMemo, useState } from "react";

import { createSeed, type Seed } from "@/games/core/seed";
import {
  assessWaterSortDifficulty,
  type WaterSortDifficulty,
} from "@/games/water-sort/game/difficulty";
import {
  generateWaterSortProblem,
  type WaterSortProblem,
} from "@/games/water-sort/game/generator";
import { calculateWaterSortPlayScore } from "@/games/water-sort/game/performance";
import {
  applyWaterSortMove,
  listWaterSortLegalMoves,
} from "@/games/water-sort/game/rules";
import {
  isCompleteWaterSortBottle,
  isWaterSortCleared,
  type WaterSortBottle,
  type WaterSortState,
} from "@/games/water-sort/game/state";

export type WaterSortBottleSelectionResult =
  | { id: number; type: "source-selected"; bottleIndex: number }
  | { id: number; type: "source-deselected"; bottleIndex: number }
  | { id: number; type: "invalid"; bottleIndex: number }
  | {
      id: number;
      type: "poured";
      sourceBottleIndex: number;
      destinationBottleIndex: number;
      sourceBefore: WaterSortBottle;
      sourceAfter: WaterSortBottle;
      destinationBefore: WaterSortBottle;
      destinationAfter: WaterSortBottle;
      isClearingMove: boolean;
    };

export type WaterSortPlayPhase = "playing" | "clearing" | "result";

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
  phase: WaterSortPlayPhase;
  selectionResult: WaterSortBottleSelectionResult | null;
  nextSelectionResultId: number;
};

const colorCountsByDifficulty: Record<WaterSortDifficulty, number> = {
  easy: 4,
  normal: 6,
  hard: 8,
};

function generateProblem(
  difficulty: WaterSortDifficulty,
  seed: Seed,
): WaterSortProblem {
  return generateWaterSortProblem({
    seed,
    colorCount: colorCountsByDifficulty[difficulty],
    acceptCandidate: ({ solveResult }) =>
      solveResult.features !== null &&
      assessWaterSortDifficulty(solveResult.features).difficulty === difficulty,
  });
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
    phase: "playing",
    selectionResult: null,
    nextSelectionResultId: 0,
  };
}

export function useWaterSortGame(difficulty: WaterSortDifficulty) {
  const [play, setPlay] = useState<WaterSortPlayState>(() =>
    createPlayState(difficulty, createSeed()),
  );
  const [now, setNow] = useState(() => Date.now());

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
    setNow(selectedAt);
    setPlay((current) => {
      const resultId = current.nextSelectionResultId;
      const withSelectionResult = (
        selectionResult: WaterSortBottleSelectionResult,
      ) => ({
        ...current,
        selectionResult,
        nextSelectionResultId: resultId + 1,
      });

      if (current.phase !== "playing" || !current.state[bottleIndex]) {
        return current;
      }

      if (current.sourceBottleIndex === null) {
        const bottle = current.state[bottleIndex];
        const hasLegalMove = listWaterSortLegalMoves(current.state).some(
          (move) => move.sourceBottleIndex === bottleIndex,
        );
        if (!bottle || isCompleteWaterSortBottle(bottle) || !hasLegalMove) {
          return withSelectionResult({
            id: resultId,
            type: "invalid",
            bottleIndex,
          });
        }

        return {
          ...withSelectionResult({
            id: resultId,
            type: "source-selected",
            bottleIndex,
          }),
          sourceBottleIndex: bottleIndex,
        };
      }

      if (current.sourceBottleIndex === bottleIndex) {
        return {
          ...withSelectionResult({
            id: resultId,
            type: "source-deselected",
            bottleIndex,
          }),
          sourceBottleIndex: null,
        };
      }

      const sourceBottleIndex = current.sourceBottleIndex;
      const nextState = applyWaterSortMove(current.state, {
        sourceBottleIndex,
        destinationBottleIndex: bottleIndex,
      });
      if (!nextState) {
        return withSelectionResult({
          id: resultId,
          type: "invalid",
          bottleIndex,
        });
      }

      const cleared = isWaterSortCleared(nextState);

      return {
        ...current,
        status: cleared ? "cleared" : "playing",
        phase: cleared ? "clearing" : "playing",
        state: nextState,
        history: [...current.history, current.state],
        finishedAt: cleared ? selectedAt : null,
        moveCount: current.moveCount + 1,
        sourceBottleIndex: null,
        selectionResult: {
          id: resultId,
          type: "poured",
          sourceBottleIndex,
          destinationBottleIndex: bottleIndex,
          sourceBefore: current.state[sourceBottleIndex] ?? [],
          sourceAfter: nextState[sourceBottleIndex] ?? [],
          destinationBefore: current.state[bottleIndex] ?? [],
          destinationAfter: nextState[bottleIndex] ?? [],
          isClearingMove: cleared,
        },
        nextSelectionResultId: resultId + 1,
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
      };
    });
  }, [difficulty]);

  const newGame = useCallback(() => {
    const next = createPlayState(difficulty, createSeed());
    setNow(next.startedAt);
    setPlay(next);
  }, [difficulty]);

  const completeClearPresentation = useCallback(() => {
    setPlay((current) =>
      current.phase === "clearing" ? { ...current, phase: "result" } : current,
    );
  }, []);

  const elapsedMs = Math.max(0, (play.finishedAt ?? now) - play.startedAt);
  const optimalMoveCount = play.problem.solutionMoves.length;
  const problemDifficulty = assessWaterSortDifficulty(play.problem.features);
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
    state: play.state,
    elapsedMs,
    moveCount: play.moveCount,
    undoCount: play.undoCount,
    restartCount: play.restartCount,
    optimalMoveCount,
    problemDifficulty,
    canUndo: play.status === "playing" && play.history.length > 0,
    sourceBottleIndex: play.sourceBottleIndex,
    phase: play.phase,
    selectionResult: play.selectionResult,
    result,
    selectBottle,
    undo,
    restart,
    newGame,
    completeClearPresentation,
  };
}
