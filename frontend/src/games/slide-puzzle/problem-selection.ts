import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";
import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import { restoreSlidePuzzleProblem } from "@/games/slide-puzzle/problem/generator";
import type { SlidePuzzleProblemIdentity } from "@/games/slide-puzzle/problem/problem";
import {
  decodeSlidePuzzlePoolEntry,
  findSlidePuzzlePoolEntryByProblemId,
  findSlidePuzzlePooledOptimalMoveCount,
  listSlidePuzzlePoolEntries,
  type SlidePuzzlePooledProblem,
  type SlidePuzzleProblemPoolEntry,
} from "@/games/slide-puzzle/problem/problem-pool";

function restorePoolEntry(
  entry: SlidePuzzleProblemPoolEntry,
): SlidePuzzlePooledProblem {
  const { identity, optimalMoveCount } = decodeSlidePuzzlePoolEntry(entry);
  return { ...restoreSlidePuzzleProblem(identity), optimalMoveCount };
}

export function selectSlidePuzzleProblemForDifficulty(
  difficulty: SlidePuzzleDifficulty,
  seed: ProblemSeed,
): SlidePuzzlePooledProblem {
  const entry = selectProblemPoolEntry(
    listSlidePuzzlePoolEntries(difficulty),
    seed,
    `level ${difficulty} slide puzzle`,
  );
  return restorePoolEntry(entry);
}

/** 難易度の問題集から問題 ID で1問を引いて復元する。引けない ID には `null` を返す。 */
export function selectSlidePuzzleProblemById(
  difficulty: SlidePuzzleDifficulty,
  problemId: string,
): SlidePuzzlePooledProblem | null {
  const entry = findSlidePuzzlePoolEntryByProblemId(difficulty, problemId);
  return entry ? restorePoolEntry(entry) : null;
}

/**
 * 記録・診断の識別情報から、問題集の最短手数付きで問題を復元する。
 * 問題集に無い識別情報では最短手数を決められないので `null` を返す。
 */
export function restoreSlidePuzzlePooledProblem(
  identity: SlidePuzzleProblemIdentity,
): SlidePuzzlePooledProblem | null {
  const optimalMoveCount = findSlidePuzzlePooledOptimalMoveCount(identity);
  return optimalMoveCount === null
    ? null
    : { ...restoreSlidePuzzleProblem(identity), optimalMoveCount };
}

/** 難易度の問題集から問題 ID で1問を引けるかを、問題を復元せずに確かめる。 */
export function canSelectSlidePuzzleProblemById(
  difficulty: SlidePuzzleDifficulty,
  problemId: string,
): boolean {
  return findSlidePuzzlePoolEntryByProblemId(difficulty, problemId) !== null;
}
