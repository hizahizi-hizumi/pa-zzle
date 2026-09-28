import { hashProblemSeed, type ProblemSeed } from "@/games/problem-seed";
import type { ReflectionDifficulty } from "@/games/reflection/difficulty";
import {
  isReflectionProblemIdentity,
  type ReflectionRecordedProblemIdentity,
} from "@/games/reflection/problem/problem";
import {
  findReflectionPooledProblem,
  findReflectionPooledProblemByReference,
  listReflectionPoolEntries,
  type ReflectionPooledProblem,
  type ReflectionProblemPoolReference,
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
  const entries = listReflectionPoolEntries(difficulty);
  if (entries.length === 0) {
    throw new Error(`No level ${difficulty} Reflection problem is available`);
  }
  return toReflectionPooledProblem(
    difficulty,
    hashProblemSeed(seed) % entries.length,
  );
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

/** 問題集の版と問題番号から同じ問題を復元する。問題集の版が今と違えば `null` を返す。 */
export function restoreReflectionPoolProblem(
  reference: ReflectionProblemPoolReference,
): ReflectionPooledProblem | null {
  return findReflectionPooledProblemByReference(reference);
}
