import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";
import type { TsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import type { TsumeShogiProblemIdentity } from "@/games/tsume-shogi/problem/problem";
import {
  findTsumeShogiPooledProblem,
  listTsumeShogiPoolEntries,
  type TsumeShogiPooledProblem,
  toTsumeShogiPooledProblem,
} from "@/games/tsume-shogi/problem/problem-pool";

/**
 * 難易度の問題集から seed で1問を選ぶ。
 * 問題集は生成時に strict validator・難易度分析・分類を済ませてあるので、プレイ時には生成・探索・分析を走らせない。
 */
export function selectTsumeShogiProblemForDifficulty(
  difficulty: TsumeShogiDifficulty,
  seed: ProblemSeed,
): TsumeShogiPooledProblem {
  // 問題集の中の位置（問題番号）を添えて復元するので、問題そのものではなく位置を選ぶ。
  const entryIndex = selectProblemPoolEntry(
    [...listTsumeShogiPoolEntries(difficulty).keys()],
    seed,
    `level ${difficulty} Tsume Shogi`,
  );
  return toTsumeShogiPooledProblem(difficulty, entryIndex);
}

/**
 * 記録などに残した identity から同じ問題を復元する。
 * 問題集に無い identity（生成器の版や条件が今と違うものなど）は `null` を返す。
 */
export function restoreTsumeShogiProblem(
  identity: TsumeShogiProblemIdentity,
): TsumeShogiPooledProblem | null {
  return findTsumeShogiPooledProblem(identity);
}
