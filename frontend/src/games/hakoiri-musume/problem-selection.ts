import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import {
  findHakoiriMusumePoolEntryByProblemId,
  type HakoiriMusumePooledProblem,
  listHakoiriMusumePoolEntries,
  restoreHakoiriMusumePoolEntry,
} from "@/games/hakoiri-musume/problem/problem-pool";
import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";

/** 問題集は盤面そのものと最短手数を持つので、プレイ時には生成も解く処理も走らせない。 */
export function selectHakoiriMusumeProblemForDifficulty(
  difficulty: HakoiriMusumeDifficulty,
  seed: ProblemSeed,
): HakoiriMusumePooledProblem {
  const entry = selectProblemPoolEntry(
    listHakoiriMusumePoolEntries(difficulty),
    seed,
    `level ${difficulty} hakoiri musume`,
  );
  return restoreHakoiriMusumePoolEntry(entry);
}

export function selectHakoiriMusumeProblemById(
  difficulty: HakoiriMusumeDifficulty,
  problemId: string,
): HakoiriMusumePooledProblem | null {
  const entry = findHakoiriMusumePoolEntryByProblemId(difficulty, problemId);
  return entry ? restoreHakoiriMusumePoolEntry(entry) : null;
}

export function canSelectHakoiriMusumeProblemById(
  difficulty: HakoiriMusumeDifficulty,
  problemId: string,
): boolean {
  return findHakoiriMusumePoolEntryByProblemId(difficulty, problemId) !== null;
}
