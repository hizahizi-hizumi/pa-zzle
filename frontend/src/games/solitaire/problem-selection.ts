import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";
import type { SolitaireDifficulty } from "@/games/solitaire/difficulty";
import {
  findSolitairePoolEntryByProblemId,
  listSolitairePoolEntries,
  restoreSolitairePoolEntry,
  type SolitairePooledProblem,
} from "@/games/solitaire/problem/problem-pool";

/** 問題集の項目は配った札そのものなので、プレイ時には生成・難易度分析を走らせない。 */
export function selectSolitaireProblemForDifficulty(
  difficulty: SolitaireDifficulty,
  seed: ProblemSeed,
): SolitairePooledProblem {
  const entry = selectProblemPoolEntry(
    listSolitairePoolEntries(difficulty),
    seed,
    `level ${difficulty} solitaire`,
  );
  return restoreSolitairePoolEntry(entry);
}

export function selectSolitaireProblemById(
  difficulty: SolitaireDifficulty,
  problemId: string,
): SolitairePooledProblem | null {
  const entry = findSolitairePoolEntryByProblemId(difficulty, problemId);
  return entry ? restoreSolitairePoolEntry(entry) : null;
}

export function canSelectSolitaireProblemById(
  difficulty: SolitaireDifficulty,
  problemId: string,
): boolean {
  return findSolitairePoolEntryByProblemId(difficulty, problemId) !== null;
}
