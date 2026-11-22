import type { MagicSquareDifficulty } from "@/games/magic-square/difficulty";
import {
  findMagicSquarePoolEntryByProblemId,
  listMagicSquarePoolEntries,
  type MagicSquarePooledProblem,
  restoreMagicSquarePoolEntry,
} from "@/games/magic-square/problem/problem-pool";
import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";

/** 問題集はレベルごとに分けて持つので、プレイ時には難易度を判定しない。 */
export function selectMagicSquareProblemForDifficulty(
  difficulty: MagicSquareDifficulty,
  seed: ProblemSeed,
): MagicSquarePooledProblem {
  const entry = selectProblemPoolEntry(
    listMagicSquarePoolEntries(difficulty),
    seed,
    `level ${difficulty} magic square`,
  );
  return restoreMagicSquarePoolEntry(entry);
}

export function selectMagicSquareProblemById(
  difficulty: MagicSquareDifficulty,
  problemId: string,
): MagicSquarePooledProblem | null {
  const entry = findMagicSquarePoolEntryByProblemId(difficulty, problemId);
  return entry === null ? null : restoreMagicSquarePoolEntry(entry);
}

export function canSelectMagicSquareProblemById(
  difficulty: MagicSquareDifficulty,
  problemId: string,
): boolean {
  return findMagicSquarePoolEntryByProblemId(difficulty, problemId) !== null;
}
