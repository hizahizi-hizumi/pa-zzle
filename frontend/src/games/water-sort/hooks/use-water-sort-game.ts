import { useCallback, useState } from "react";

import { createSeed, type Seed } from "@/games/core/seed";
import type { WaterSortDifficulty } from "@/games/water-sort/game/difficulty";

type WaterSortPlayState =
  | { status: "playing"; seed: Seed }
  | { status: "cleared"; seed: Seed };

export function useWaterSortGame(difficulty: WaterSortDifficulty) {
  const [play, setPlay] = useState<WaterSortPlayState>(() => ({
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
