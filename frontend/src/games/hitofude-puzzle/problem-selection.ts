import type { HamiltonianPathDifficulty } from "@/games/hamiltonian-path/difficulty";
import {
  type HamiltonianPathRecordedProblemIdentity,
  isHamiltonianPathProblemIdentity,
} from "@/games/hamiltonian-path/problem/problem";
import {
  findHamiltonianPathPoolEntry,
  findHamiltonianPathPoolEntryByProblemId,
  type HamiltonianPathPooledProblem,
  listHamiltonianPathPoolEntries,
  toHamiltonianPathPooledProblem,
} from "@/games/hamiltonian-path/problem/problem-pool";
import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";

/**
 * 難易度の問題集から seed で1問を選ぶ。
 * 問題集は生成時に一意解と難易度を確かめ済みで、基準時間に使う作業の量も持つため、
 * プレイ時には生成・解探索・難易度分析を走らせない。
 */
export function selectHamiltonianPathProblemForDifficulty(
  difficulty: HamiltonianPathDifficulty,
  seed: ProblemSeed,
): HamiltonianPathPooledProblem {
  const entry = selectProblemPoolEntry(
    listHamiltonianPathPoolEntries(difficulty),
    seed,
    `level ${difficulty} Hamiltonian path`,
  );
  return toHamiltonianPathPooledProblem(entry);
}

/**
 * 記録に残した identity から同じ問題を復元する。
 * 問題集に無い identity（生成器の版が今と違う記録など）は復元できないので `null` を返す。
 */
export function restoreHamiltonianPathProblem(
  identity: HamiltonianPathRecordedProblemIdentity,
): HamiltonianPathPooledProblem | null {
  const entry = isHamiltonianPathProblemIdentity(identity)
    ? findHamiltonianPathPoolEntry(identity)
    : null;
  return entry ? toHamiltonianPathPooledProblem(entry) : null;
}

/** 難易度の問題集から問題 ID で1問を引く。引けない ID には `null` を返す。 */
export function selectHamiltonianPathProblemById(
  difficulty: HamiltonianPathDifficulty,
  problemId: string,
): HamiltonianPathPooledProblem | null {
  const entry = findHamiltonianPathPoolEntryByProblemId(difficulty, problemId);
  return entry ? toHamiltonianPathPooledProblem(entry) : null;
}

/** 難易度の問題集から問題 ID で1問を引けるかを、問題を復元せずに確かめる。 */
export function canSelectHamiltonianPathProblemById(
  difficulty: HamiltonianPathDifficulty,
  problemId: string,
): boolean {
  return (
    findHamiltonianPathPoolEntryByProblemId(difficulty, problemId) !== null
  );
}
