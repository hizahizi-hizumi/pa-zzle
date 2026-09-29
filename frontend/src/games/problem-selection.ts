import { hashProblemSeed, type ProblemSeed } from "@/games/problem-seed";

/**
 * 問題集から seed で1問を選ぶ。同じ seed と問題集からは同じ1問を選ぶ。
 * `poolDescription` は問題集が空のときの例外で、どの問題集かを示す。
 */
export function selectProblemPoolEntry<Entry>(
  entries: readonly Entry[],
  seed: ProblemSeed,
  poolDescription: string,
): Entry {
  const entry = entries[hashProblemSeed(seed) % entries.length];
  if (entry === undefined) {
    throw new Error(`No ${poolDescription} problem is available`);
  }
  return entry;
}
