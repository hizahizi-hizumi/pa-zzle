import type { HitofudePuzzleDifficulty } from "@/games/hitofude-puzzle/difficulty";
import type { HitofudePuzzleProblem } from "@/games/hitofude-puzzle/problem/problem";
import {
  type HitofudePuzzleRecordedProblemIdentity,
  isHitofudePuzzleProblemIdentity,
} from "@/games/hitofude-puzzle/problem/problem";
import {
  decodeHitofudePuzzlePoolProblem,
  findHitofudePuzzlePoolEntry,
  findHitofudePuzzlePoolEntryByProblemId,
  type HitofudePuzzlePooledProblem,
  listHitofudePuzzlePoolEntries,
  toHitofudePuzzlePooledProblem,
} from "@/games/hitofude-puzzle/problem/problem-pool";
import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";

/**
 * 難易度の問題集から seed で1問を選ぶ。
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

/**
 * 記録に残した identity から同じ問題を復元する。
 * 問題集に無い identity（生成器の版が今と違う記録など）は復元できないので `null` を返す。
 */
export function restoreHitofudePuzzleProblem(
  identity: HitofudePuzzleRecordedProblemIdentity,
): HitofudePuzzlePooledProblem | null {
  const entry = isHitofudePuzzleProblemIdentity(identity)
    ? findHitofudePuzzlePoolEntry(identity)
    : null;
  return entry ? toHitofudePuzzlePooledProblem(entry) : null;
}

/** 難易度の問題集から問題 ID で1問を引く。引けない ID には `null` を返す。 */
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

/**
 * 難易度選択の見本にする、そのレベルの代表の1問。問題集から決定的に選ぶ。
 * レベルで遊ぶ最も大きい盤面の問題のうち、穴の数が真ん中（同じ数なら問題集の先）のもの。
 * 大きさの違いと、そのレベルでよく見る穴の量を見せる。
 */
export function selectHitofudePuzzlePreviewProblem(
  difficulty: HitofudePuzzleDifficulty,
): HitofudePuzzleProblem {
  const entries = listHitofudePuzzlePoolEntries(difficulty);
  const largestSize = Math.max(...entries.map(([size]) => size));
  const problems = entries
    .filter(([size]) => size === largestSize)
    .map(([size, , , start, encodedHoles]) =>
      decodeHitofudePuzzlePoolProblem(size, start, encodedHoles),
    )
    .sort((left, right) => left.holes.length - right.holes.length);
  const median = problems[Math.floor((problems.length - 1) / 2)];
  if (median === undefined) {
    throw new RangeError(
      `No level ${difficulty} Hitofude puzzle in the problem pool`,
    );
  }
  return median;
}
