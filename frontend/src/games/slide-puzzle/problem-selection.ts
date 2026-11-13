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

export function selectSlidePuzzleProblemById(
  difficulty: SlidePuzzleDifficulty,
  problemId: string,
): SlidePuzzlePooledProblem | null {
  const entry = findSlidePuzzlePoolEntryByProblemId(difficulty, problemId);
  return entry ? restorePoolEntry(entry) : null;
}

/** 問題集に無い識別情報では最短手数を決められないので `null` を返す。 */
export function restoreSlidePuzzlePooledProblem(
  identity: SlidePuzzleProblemIdentity,
): SlidePuzzlePooledProblem | null {
  const optimalMoveCount = findSlidePuzzlePooledOptimalMoveCount(identity);
  return optimalMoveCount === null
    ? null
    : { ...restoreSlidePuzzleProblem(identity), optimalMoveCount };
}

export function canSelectSlidePuzzleProblemById(
  difficulty: SlidePuzzleDifficulty,
  problemId: string,
): boolean {
  return findSlidePuzzlePoolEntryByProblemId(difficulty, problemId) !== null;
}
