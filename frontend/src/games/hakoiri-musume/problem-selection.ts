import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import {
  findHakoiriMusumePoolEntryByProblemId,
  type HakoiriMusumePooledProblem,
  listHakoiriMusumePoolEntries,
  restoreHakoiriMusumePoolEntry,
} from "@/games/hakoiri-musume/problem/problem-pool";
import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";

/**
 * 難易度の問題集から seed で1問を選ぶ。
 * 問題集は盤面そのものと最短手数を持つので、プレイ時には生成も解く処理も走らせない。
 */
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

/** 難易度の問題集から問題 ID で1問を引いて復元する。引けない ID には `null` を返す。 */
export function selectHakoiriMusumeProblemById(
  difficulty: HakoiriMusumeDifficulty,
  problemId: string,
): HakoiriMusumePooledProblem | null {
  const entry = findHakoiriMusumePoolEntryByProblemId(difficulty, problemId);
  return entry ? restoreHakoiriMusumePoolEntry(entry) : null;
}

/** 難易度の問題集から問題 ID で1問を引けるかを、問題を復元せずに確かめる。 */
export function canSelectHakoiriMusumeProblemById(
  difficulty: HakoiriMusumeDifficulty,
  problemId: string,
): boolean {
  return findHakoiriMusumePoolEntryByProblemId(difficulty, problemId) !== null;
}
