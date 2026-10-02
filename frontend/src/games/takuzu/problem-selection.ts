import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import {
  isTakuzuProblemIdentity,
  type TakuzuRecordedProblemIdentity,
} from "@/games/takuzu/problem/problem";
import {
  findTakuzuPoolEntry,
  findTakuzuPoolEntryByProblemId,
  listTakuzuPoolEntries,
  type TakuzuPooledProblem,
  toTakuzuPooledProblem,
} from "@/games/takuzu/problem/problem-pool";

/**
 * 難易度の問題集から seed で1問を選ぶ。
 * 問題集は生成時に難易度を判定済みで、解と基準時間に使う作業の量も持つため、
 * プレイ時には生成・解探索・難易度分析を走らせない。
 */
export function selectTakuzuProblemForDifficulty(
  difficulty: TakuzuDifficulty,
  seed: ProblemSeed,
): TakuzuPooledProblem {
  const entry = selectProblemPoolEntry(
    listTakuzuPoolEntries(difficulty),
    seed,
    `level ${difficulty} Takuzu`,
  );
  return toTakuzuPooledProblem(entry);
}

/**
 * 記録に残した identity から同じ問題を復元する。
 * 問題集に無い identity（生成器の版が今と違う記録など）は再プレイできないので `null` を返す。
 */
export function restoreTakuzuProblem(
  identity: TakuzuRecordedProblemIdentity,
): TakuzuPooledProblem | null {
  const entry = isTakuzuProblemIdentity(identity)
    ? findTakuzuPoolEntry(identity)
    : null;
  return entry ? toTakuzuPooledProblem(entry) : null;
}

/** 難易度の問題集から問題 ID で1問を引く。引けない ID には `null` を返す。 */
export function selectTakuzuProblemById(
  difficulty: TakuzuDifficulty,
  problemId: string,
): TakuzuPooledProblem | null {
  const entry = findTakuzuPoolEntryByProblemId(difficulty, problemId);
  return entry ? toTakuzuPooledProblem(entry) : null;
}
