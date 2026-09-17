import { useCallback, useEffect, useMemo, useState } from "react";

import { createSeed, type Seed } from "@/games/core/seed";
import type { WaterSortDifficulty } from "@/games/water-sort/game/difficulty";
import {
  generateWaterSortProblem,
  type WaterSortProblem,
} from "@/games/water-sort/game/generator";
import {
  applyWaterSortMove,
  listWaterSortLegalMoves,
} from "@/games/water-sort/game/rules";
import {
  isCompleteWaterSortBottle,
  isWaterSortCleared,
  type WaterSortState,
} from "@/games/water-sort/game/state";

export type WaterSortResult = {
  elapsedMs: number;
  moveCount: number;
  undoCount: number;
  restartCount: number;
  optimalMoveCount: number;
  moveDelta: number;
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
      if (current.status !== "playing" || !current.state[bottleIndex]) {
        return current;
      }

      if (current.sourceBottleIndex === null) {
        const bottle = current.state[bottleIndex];
        const hasLegalMove = listWaterSortLegalMoves(current.state).some(
          (move) => move.sourceBottleIndex === bottleIndex,
        );
        if (!bottle || isCompleteWaterSortBottle(bottle) || !hasLegalMove) {
          return current;
        }

        return { ...current, sourceBottleIndex: bottleIndex };
      }

      if (current.sourceBottleIndex === bottleIndex) {
        return { ...current, sourceBottleIndex: null };
      }

      const nextState = applyWaterSortMove(current.state, {
        sourceBottleIndex: current.sourceBottleIndex,
        destinationBottleIndex: bottleIndex,
      });
      if (!nextState) {
        return current;
      }

      const cleared = isWaterSortCleared(nextState);

      return {
        ...current,
        status: cleared ? "cleared" : "playing",
        state: nextState,
        history: [...current.history, current.state],
        finishedAt: cleared ? selectedAt : null,
        moveCount: current.moveCount + 1,
        sourceBottleIndex: null,
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

  const selectableBottleIndexes = useMemo(() => {
    if (play.status !== "playing") {
      return new Set<number>();
    }

    const legalMoves = listWaterSortLegalMoves(play.state);
    if (play.sourceBottleIndex === null) {
      return new Set(
        legalMoves
          .map((move) => move.sourceBottleIndex)
          .filter(
            (bottleIndex) =>
              !isCompleteWaterSortBottle(play.state[bottleIndex] ?? []),
          ),
      );
    }

    const selectable = new Set<number>([play.sourceBottleIndex]);
    for (const move of legalMoves) {
      if (move.sourceBottleIndex === play.sourceBottleIndex) {
        selectable.add(move.destinationBottleIndex);
      }
    }
    return selectable;
  }, [play.sourceBottleIndex, play.state, play.status]);

  const elapsedMs = Math.max(0, (play.finishedAt ?? now) - play.startedAt);
  const optimalMoveCount = play.problem.solutionMoves.length;
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
    canUndo: play.status === "playing" && play.history.length > 0,
    sourceBottleIndex: play.sourceBottleIndex,
    selectableBottleIndexes,
    result,
    selectBottle,
    undo,
    restart,
    newGame,
  };
}
