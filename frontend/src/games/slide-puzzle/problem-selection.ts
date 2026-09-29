import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";
import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import { restoreSlidePuzzleProblemWithOptimalMoveCount } from "@/games/slide-puzzle/problem/generator";
import type {
  SlidePuzzleGeneratedProblem,
  SlidePuzzleProblemIdentity,
} from "@/games/slide-puzzle/problem/problem";
import {
  findSlidePuzzlePooledOptimalMoveCount,
  listSlidePuzzlePoolEntries,
  toSlidePuzzlePooledProblem,
} from "@/games/slide-puzzle/problem/problem-pool";

export function selectSlidePuzzleProblemForDifficulty(
  difficulty: SlidePuzzleDifficulty,
  seed: ProblemSeed,
): SlidePuzzleGeneratedProblem {
  const entry = selectProblemPoolEntry(
    listSlidePuzzlePoolEntries(difficulty),
    seed,
    `level ${difficulty} slide puzzle`,
  );

  const { identity, optimalMoveCount } = toSlidePuzzlePooledProblem(entry);
  return restoreSlidePuzzleProblemWithOptimalMoveCount(
    identity,
    optimalMoveCount,
  );
}

/**
 * 記録・診断の識別情報から、問題集の最短手数付きで問題を復元する。
 * 問題集に無い識別情報では最短手数を決められないので `null` を返す。
 */
export function restoreSlidePuzzlePooledProblem(
  identity: SlidePuzzleProblemIdentity,
): SlidePuzzleGeneratedProblem | null {
  const optimalMoveCount = findSlidePuzzlePooledOptimalMoveCount(identity);
  return optimalMoveCount === null
    ? null
    : restoreSlidePuzzleProblemWithOptimalMoveCount(identity, optimalMoveCount);
}
