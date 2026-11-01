import type { NonogramDifficulty } from "@/games/nonogram/difficulty";
import {
  isNonogramProblemIdentity,
  type NonogramRecordedProblemIdentity,
} from "@/games/nonogram/problem/problem";
import {
  findNonogramPooledProblemByProblemId,
  hasNonogramPoolProblemId,
  listNonogramPoolEntries,
  type NonogramPooledProblem,
  toNonogramPooledProblem,
} from "@/games/nonogram/problem/problem-pool";
import { createProblemId } from "@/games/problem-id";
import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";

/**
 * 難易度の問題集から seed で1問を選ぶ。
 * 問題集は生成時に難易度を判定済みで、解と基準時間に使う作業の量も持つため、
 * プレイ時には生成・線の読み・難易度分析を走らせない。
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

/** 難易度の問題集から問題 ID で1問を引けるかを、問題を復元せずに確かめる。 */
export function canSelectNonogramProblemById(
  difficulty: NonogramDifficulty,
  problemId: string,
): boolean {
  return hasNonogramPoolProblemId(difficulty, problemId);
}

/**
 * 記録に残した identity から、その難易度の問題集の同じ問題を復元する。
 * 問題集に無い identity（生成器の版が今と違う記録など）は復元できないので `null` を返す。
 */
export function restoreNonogramProblem(
  difficulty: NonogramDifficulty,
  identity: NonogramRecordedProblemIdentity,
): NonogramPooledProblem | null {
  return isNonogramProblemIdentity(identity)
    ? selectNonogramProblemById(difficulty, createProblemId(identity))
    : null;
}
