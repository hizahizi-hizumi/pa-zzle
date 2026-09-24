import { hashProblemSeed, type ProblemSeed } from "@/games/problem-seed";
import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import { restoreWaterSortProblemWithOptimalMoveCount } from "@/games/water-sort/problem/generator";
import type { WaterSortGeneratedProblem } from "@/games/water-sort/problem/problem";
import {
  listWaterSortPoolEntries,
  toWaterSortPooledProblem,
} from "@/games/water-sort/problem/problem-pool";

export function selectWaterSortProblemForDifficulty(
  difficulty: WaterSortDifficulty,
  seed: ProblemSeed,
): WaterSortGeneratedProblem {
  const entries = listWaterSortPoolEntries(difficulty);
  const entry = entries[hashProblemSeed(seed) % entries.length];
  if (!entry) {
    throw new Error(`No level ${difficulty} water sort problem is available`);
  }

  const { identity, optimalMoveCount } = toWaterSortPooledProblem(entry);
  return restoreWaterSortProblemWithOptimalMoveCount(
    identity,
    optimalMoveCount,
  );
}
