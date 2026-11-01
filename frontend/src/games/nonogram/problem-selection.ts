import type { NonogramDifficulty } from "@/games/nonogram/difficulty";
import {
  findNonogramPooledProblemByProblemId,
  listNonogramPoolEntries,
  type NonogramPooledProblem,
  toNonogramPooledProblem,
} from "@/games/nonogram/problem/problem-pool";
import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";

/**
 * 難易度の問題集から seed で1問を選ぶ。
 * 問題集は生成時に難易度を判定済みで、解と難易度の特徴も持つため、プレイ時には生成・線の読み・難易度分析を走らせない。
 */
export function selectNonogramProblemForDifficulty(
  difficulty: NonogramDifficulty,
  seed: ProblemSeed,
): NonogramPooledProblem {
  // 問題集の中の位置（問題番号）を添えて復元するので、問題そのものではなく位置を選ぶ。
  const entryIndex = selectProblemPoolEntry(
    [...listNonogramPoolEntries(difficulty).keys()],
    seed,
    `level ${difficulty} Nonogram`,
  );
  return toNonogramPooledProblem(difficulty, entryIndex);
}

/** 難易度の問題集から問題 ID で1問を引く。引けない ID には `null` を返す。 */
export function selectNonogramProblemById(
  difficulty: NonogramDifficulty,
  problemId: string,
): NonogramPooledProblem | null {
  return findNonogramPooledProblemByProblemId(difficulty, problemId);
}
