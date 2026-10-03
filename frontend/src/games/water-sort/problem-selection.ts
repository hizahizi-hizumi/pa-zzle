import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";
import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import { restoreWaterSortProblemWithOptimalMoveCount } from "@/games/water-sort/problem/generator";
import type { WaterSortGeneratedProblem } from "@/games/water-sort/problem/problem";
import {
  findWaterSortPoolEntryByProblemId,
  listWaterSortPoolEntries,
  toWaterSortPooledProblem,
  type WaterSortProblemPoolEntry,
} from "@/games/water-sort/problem/problem-pool";

function restorePoolEntry(
  entry: WaterSortProblemPoolEntry,
): WaterSortGeneratedProblem {
  const { identity, optimalMoveCount } = toWaterSortPooledProblem(entry);
  return restoreWaterSortProblemWithOptimalMoveCount(
    identity,
    optimalMoveCount,
  );
}

export function selectWaterSortProblemForDifficulty(
  difficulty: WaterSortDifficulty,
  seed: ProblemSeed,
): WaterSortGeneratedProblem {
  const entry = selectProblemPoolEntry(
    listWaterSortPoolEntries(difficulty),
    seed,
    `level ${difficulty} water sort`,
  );
  return restorePoolEntry(entry);
}

/** 難易度の問題集から問題 ID で1問を引いて復元する。引けない ID には `null` を返す。 */
export function selectWaterSortProblemById(
  difficulty: WaterSortDifficulty,
  problemId: string,
): WaterSortGeneratedProblem | null {
  const entry = findWaterSortPoolEntryByProblemId(difficulty, problemId);
  return entry ? restorePoolEntry(entry) : null;
}

/** 難易度の問題集から問題 ID で1問を引けるかを、問題を復元せずに確かめる。 */
export function canSelectWaterSortProblemById(
  difficulty: WaterSortDifficulty,
  problemId: string,
): boolean {
  return findWaterSortPoolEntryByProblemId(difficulty, problemId) !== null;
}
