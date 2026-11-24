import type { FukumenzanDifficulty } from "@/games/fukumenzan/difficulty";
import {
  type FukumenzanRecordedProblemIdentity,
  isCurrentFukumenzanProblemIdentity,
} from "@/games/fukumenzan/problem/problem";
import {
  type FukumenzanPooledProblem,
  findFukumenzanPoolEntry,
  findFukumenzanPoolEntryByProblemId,
  listFukumenzanPoolEntries,
  toFukumenzanPooledProblem,
} from "@/games/fukumenzan/problem/problem-pool";
import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";

export function selectFukumenzanProblemForDifficulty(
  difficulty: FukumenzanDifficulty,
  seed: ProblemSeed,
): FukumenzanPooledProblem {
  const entry = selectProblemPoolEntry(
    listFukumenzanPoolEntries(difficulty),
    seed,
    `level ${difficulty} Fukumenzan`,
  );
  return toFukumenzanPooledProblem(entry);
}

/** 問題集に無い identity（生成器の版が今と違う記録など）は復元できないので `null` を返す。 */
export function restoreFukumenzanProblem(
  identity: FukumenzanRecordedProblemIdentity,
): FukumenzanPooledProblem | null {
  const entry = isCurrentFukumenzanProblemIdentity(identity)
    ? findFukumenzanPoolEntry(identity)
    : null;
  return entry ? toFukumenzanPooledProblem(entry) : null;
}

export function selectFukumenzanProblemById(
  difficulty: FukumenzanDifficulty,
  problemId: string,
): FukumenzanPooledProblem | null {
  const entry = findFukumenzanPoolEntryByProblemId(difficulty, problemId);
  return entry ? toFukumenzanPooledProblem(entry) : null;
}

export function canSelectFukumenzanProblemById(
  difficulty: FukumenzanDifficulty,
  problemId: string,
): boolean {
  return findFukumenzanPoolEntryByProblemId(difficulty, problemId) !== null;
}
