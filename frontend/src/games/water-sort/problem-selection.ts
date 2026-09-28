import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";
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
  const entry = selectProblemPoolEntry(
    listWaterSortPoolEntries(difficulty),
    seed,
    `level ${difficulty} water sort`,
  );

  const { identity, optimalMoveCount } = toWaterSortPooledProblem(entry);
  return restoreWaterSortProblemWithOptimalMoveCount(
    identity,
    optimalMoveCount,
  );
}
