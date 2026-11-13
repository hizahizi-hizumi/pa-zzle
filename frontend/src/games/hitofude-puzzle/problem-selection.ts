import type { HitofudePuzzleDifficulty } from "@/games/hitofude-puzzle/difficulty";
import {
  type HitofudePuzzleRecordedProblemIdentity,
  isCurrentHitofudePuzzleProblemIdentity,
} from "@/games/hitofude-puzzle/problem/problem";
import {
  findHitofudePuzzlePoolEntry,
  findHitofudePuzzlePoolEntryByProblemId,
  type HitofudePuzzlePooledProblem,
  listHitofudePuzzlePoolEntries,
  toHitofudePuzzlePooledProblem,
} from "@/games/hitofude-puzzle/problem/problem-pool";
import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";

/**
 * 問題集は生成時に一意解と難易度を確かめ済みで、基準時間に使う作業の量も持つため、
 * プレイ時には生成・解探索・難易度分析を走らせない。
 */
export function selectHitofudePuzzleProblemForDifficulty(
  difficulty: HitofudePuzzleDifficulty,
  seed: ProblemSeed,
): HitofudePuzzlePooledProblem {
  const entry = selectProblemPoolEntry(
    listHitofudePuzzlePoolEntries(difficulty),
    seed,
    `level ${difficulty} Hitofude puzzle`,
  );
  return toHitofudePuzzlePooledProblem(entry);
}

/** 問題集に無い identity（生成器の版が今と違う記録など）は復元できないので `null` を返す。 */
export function restoreHitofudePuzzleProblem(
  identity: HitofudePuzzleRecordedProblemIdentity,
): HitofudePuzzlePooledProblem | null {
  const entry = isCurrentHitofudePuzzleProblemIdentity(identity)
    ? findHitofudePuzzlePoolEntry(identity)
    : null;
  return entry ? toHitofudePuzzlePooledProblem(entry) : null;
}

export function selectHitofudePuzzleProblemById(
  difficulty: HitofudePuzzleDifficulty,
  problemId: string,
): HitofudePuzzlePooledProblem | null {
  const entry = findHitofudePuzzlePoolEntryByProblemId(difficulty, problemId);
  return entry ? toHitofudePuzzlePooledProblem(entry) : null;
}

/** 難易度の問題集から問題 ID で1問を引けるかを、問題を復元せずに確かめる。 */
export function canSelectHitofudePuzzleProblemById(
  difficulty: HitofudePuzzleDifficulty,
  problemId: string,
): boolean {
  return findHitofudePuzzlePoolEntryByProblemId(difficulty, problemId) !== null;
}
