import { useCallback, useState } from "react";

import { createSeed, type Seed } from "@/games/core/seed";
import type { SudokuDifficulty } from "@/games/sudoku/game/difficulty";

type SudokuPlayState =
  | { status: "playing"; seed: Seed }
  | { status: "cleared"; seed: Seed };

export function useSudokuGame(difficulty: SudokuDifficulty) {
  const [play, setPlay] = useState<SudokuPlayState>(() => ({
    status: "playing",
    seed: createSeed(),
  }));

  const clear = useCallback(() => {
    setPlay((current) => ({ status: "cleared", seed: current.seed }));
  }, []);

  const retry = useCallback(() => {
    setPlay({ status: "playing", seed: createSeed() });
  }, []);

  return {
    difficulty,
    seed: play.seed,
    status: play.status,
    clear,
    retry,
  };
}
