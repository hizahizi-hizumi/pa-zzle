import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";
import type { ReflectionDifficulty } from "@/games/reflection/difficulty";
import {
  isCurrentReflectionProblemIdentity,
  type ReflectionRecordedProblemIdentity,
} from "@/games/reflection/problem/problem";
import {
  findReflectionPooledProblem,
  findReflectionPooledProblemByProblemId,
  hasReflectionPoolProblemId,
  listReflectionPoolEntries,
  type ReflectionPooledProblem,
  toReflectionPooledProblem,
} from "@/games/reflection/problem/problem-pool";

/**
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

/** 問題集に無い identity（生成器の版が今と違う記録など）は復元できないので `null` を返す。 */
export function restoreReflectionProblem(
  identity: ReflectionRecordedProblemIdentity,
): ReflectionPooledProblem | null {
  return isCurrentReflectionProblemIdentity(identity)
    ? findReflectionPooledProblem(identity)
    : null;
}

export function selectReflectionProblemById(
  difficulty: ReflectionDifficulty,
  problemId: string,
): ReflectionPooledProblem | null {
  return findReflectionPooledProblemByProblemId(difficulty, problemId);
}

/** 難易度の問題集から問題 ID で1問を引けるかを、問題を復元せずに確かめる。 */
export function canSelectReflectionProblemById(
  difficulty: ReflectionDifficulty,
  problemId: string,
): boolean {
  return hasReflectionPoolProblemId(difficulty, problemId);
}
