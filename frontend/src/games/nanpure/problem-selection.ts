import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import {
  isNanpureProblemIdentity,
  type NanpureIdentifiedProblem,
} from "@/games/nanpure/problem/problem";
import {
  findNanpurePoolEntry,
  listNanpurePoolEntries,
  toNanpurePooledProblem,
} from "@/games/nanpure/problem/problem-pool";
import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";

/**
 * 難易度の問題集から seed で1問を選ぶ。
 * 問題集は生成時に難易度を判定済みで解も持つため、プレイ時には生成・解探索・難易度分析を走らせない。
 */
export function selectNanpureProblemForDifficulty(
  difficulty: NanpureDifficulty,
  seed: ProblemSeed,
): NanpureIdentifiedProblem {
  const entry = selectProblemPoolEntry(
    listNanpurePoolEntries(difficulty),
    seed,
    `level ${difficulty} Nanpure`,
  );
  return toNanpurePooledProblem(entry);
}

/**
 * 記録に残した identity から同じ問題を復元する。
 * 問題集に無い identity（生成器の版が今と違う記録など）は再プレイできないので `null` を返す。
 */
export function restoreNanpureProblem(
  identity: unknown,
): NanpureIdentifiedProblem | null {
  const entry = isNanpureProblemIdentity(identity)
    ? findNanpurePoolEntry(identity)
    : null;
  return entry ? toNanpurePooledProblem(entry) : null;
}
