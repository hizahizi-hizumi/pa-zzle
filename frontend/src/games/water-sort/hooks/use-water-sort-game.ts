import { useCallback, useEffect, useMemo, useState } from "react";

import { createSeed, type Seed } from "@/games/core/seed";
import type { WaterSortDifficulty } from "@/games/water-sort/game/difficulty";

type WaterSortSelection = {
  sourceBottleId: string | null;
  targetBottleId: string | null;
};

type WaterSortPlayState = {
  status: "playing" | "cleared";
  seed: Seed;
  startedAt: number;
  finishedAt: number | null;
  moveCount: number;
  undoCount: number;
  restartCount: number;
  undoDepth: number;
  selection: WaterSortSelection;
};

export type WaterSortResult = {
  elapsedMs: number;
  moveCount: number;
  undoCount: number;
  restartCount: number;
};

const emptySelection: WaterSortSelection = {
  sourceBottleId: null,
  targetBottleId: null,
};

function createPlayState(seed: Seed): WaterSortPlayState {
  return {
    status: "playing",
    seed,
    startedAt: Date.now(),
    finishedAt: null,
    moveCount: 0,
    undoCount: 0,
    restartCount: 0,
    undoDepth: 0,
    selection: emptySelection,
  };
}

export function useWaterSortGame(difficulty: WaterSortDifficulty) {
  const [play, setPlay] = useState<WaterSortPlayState>(() =>
    createPlayState(createSeed()),
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

  const selectBottle = useCallback((bottleId: string) => {
    setPlay((current) => {
      if (current.status !== "playing") {
        return current;
      }

      const { sourceBottleId, targetBottleId } = current.selection;

      if (targetBottleId !== null) {
        return {
          ...current,
          selection: { sourceBottleId: bottleId, targetBottleId: null },
        };
      }

      if (sourceBottleId === null) {
        return {
          ...current,
          selection: { sourceBottleId: bottleId, targetBottleId: null },
        };
      }

      if (sourceBottleId === bottleId) {
        return { ...current, selection: emptySelection };
      }

      return {
        ...current,
        selection: { sourceBottleId, targetBottleId: bottleId },
      };
    });
  }, []);

  const clearSelection = useCallback(() => {
    setPlay((current) => ({ ...current, selection: emptySelection }));
  }, []);

  const recordMove = useCallback(() => {
    setPlay((current) => {
      if (current.status !== "playing") {
        return current;
      }

      return {
        ...current,
        moveCount: current.moveCount + 1,
        undoDepth: current.undoDepth + 1,
        selection: emptySelection,
      };
    });
  }, []);

  const undo = useCallback(() => {
    setPlay((current) => {
      if (current.status !== "playing" || current.undoDepth === 0) {
        return current;
      }

      return {
        ...current,
        undoCount: current.undoCount + 1,
        undoDepth: current.undoDepth - 1,
        selection: emptySelection,
      };
    });
  }, []);

  const restart = useCallback(() => {
    setPlay((current) => ({
      ...current,
      status: "playing",
      finishedAt: null,
      restartCount: current.restartCount + 1,
      undoDepth: 0,
      selection: emptySelection,
    }));
  }, []);

  const newGame = useCallback(() => {
    const next = createPlayState(createSeed());
    setNow(next.startedAt);
    setPlay(next);
  }, []);

  const complete = useCallback(() => {
    const finishedAt = Date.now();
    setNow(finishedAt);
    setPlay((current) => {
      if (current.status !== "playing") {
        return current;
      }

      return {
        ...current,
        status: "cleared",
        finishedAt,
        selection: emptySelection,
      };
    });
  }, []);

  const elapsedMs = Math.max(0, (play.finishedAt ?? now) - play.startedAt);
  const result = useMemo<WaterSortResult | null>(() => {
    if (play.status !== "cleared") {
      return null;
    }

    return {
      elapsedMs,
      moveCount: play.moveCount,
      undoCount: play.undoCount,
      restartCount: play.restartCount,
    };
  }, [
    elapsedMs,
    play.moveCount,
    play.restartCount,
    play.status,
    play.undoCount,
  ]);

  return {
    difficulty,
    seed: play.seed,
    status: play.status,
    elapsedMs,
    moveCount: play.moveCount,
    undoCount: play.undoCount,
    restartCount: play.restartCount,
    canUndo: play.status === "playing" && play.undoDepth > 0,
    sourceBottleId: play.selection.sourceBottleId,
    targetBottleId: play.selection.targetBottleId,
    result,
    selectBottle,
    clearSelection,
    recordMove,
    undo,
    restart,
    newGame,
    complete,
  };
}
