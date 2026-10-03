import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";
import type { ReflectionDifficulty } from "@/games/reflection/difficulty";
import {
  isReflectionProblemIdentity,
  type ReflectionRecordedProblemIdentity,
} from "@/games/reflection/problem/problem";
import {
  findReflectionPooledProblem,
  listReflectionPoolEntries,
  type ReflectionPooledProblem,
  toReflectionPooledProblem,
} from "@/games/reflection/problem/problem-pool";

/**
 * 難易度の問題集から seed で1問を選ぶ。
 * 問題集は生成時に難易度を判定済みで、解と基準時間に使う作業の量も持つため、
 * プレイ時には生成・解探索・難易度分析を走らせない。
 */
export function selectReflectionProblemForDifficulty(
  difficulty: ReflectionDifficulty,
  seed: ProblemSeed,
): ReflectionPooledProblem {
  // 問題集の中の位置（問題番号）を添えて復元するので、問題そのものではなく位置を選ぶ。
  const entryIndex = selectProblemPoolEntry(
    [...listReflectionPoolEntries(difficulty).keys()],
    seed,
    `level ${difficulty} Reflection`,
  );
  return toReflectionPooledProblem(difficulty, entryIndex);
}

/**
 * 記録に残した identity から同じ問題を復元する。
 * 問題集に無い identity（生成器の版が今と違う記録など）は再プレイできないので `null` を返す。
 */
export function restoreReflectionProblem(
  identity: ReflectionRecordedProblemIdentity,
): ReflectionPooledProblem | null {
  return isReflectionProblemIdentity(identity)
    ? findReflectionPooledProblem(identity)
    : null;
}
