import { hashProblemSeed, type ProblemSeed } from "@/games/problem-seed";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import type {
  TakuzuIdentifiedProblem,
  TakuzuProblemIdentity,
} from "@/games/takuzu/problem/problem";
import {
  findTakuzuPoolEntry,
  listTakuzuPoolEntries,
  toTakuzuPooledProblem,
} from "@/games/takuzu/problem/problem-pool";

/**
 * 難易度の問題集から seed で1問を選ぶ。
 * 問題集は生成時に難易度を判定済みで解も持つため、プレイ時には生成・解探索・難易度分析を走らせない。
 */
export function selectTakuzuProblemForDifficulty(
  difficulty: TakuzuDifficulty,
  seed: ProblemSeed,
): TakuzuIdentifiedProblem {
  const entries = listTakuzuPoolEntries(difficulty);
  const entry = entries[hashProblemSeed(seed) % entries.length];
  if (!entry) {
    throw new Error(`No level ${difficulty} Takuzu problem is available`);
  }
  return toTakuzuPooledProblem(entry);
}

/**
 * 記録に残した identity から同じ問題を復元する。
 * 問題集に無い identity（生成器の版が変わった後の古い記録など）は再プレイできないので `null` を返す。
 */
export function restoreTakuzuProblem(
  identity: TakuzuProblemIdentity,
): TakuzuIdentifiedProblem | null {
  const entry = findTakuzuPoolEntry(identity);
  return entry ? toTakuzuPooledProblem(entry) : null;
}
