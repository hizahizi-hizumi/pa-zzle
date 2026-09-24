import type { FifteenPuzzleDifficulty } from "@/games/fifteen-puzzle/difficulty";
import { restoreFifteenPuzzleProblemWithOptimalMoveCount } from "@/games/fifteen-puzzle/problem/generator";
import type {
  FifteenPuzzleGeneratedProblem,
  FifteenPuzzleProblemIdentity,
} from "@/games/fifteen-puzzle/problem/problem";
import {
  findFifteenPuzzlePooledOptimalMoveCount,
  listFifteenPuzzlePoolEntries,
  toFifteenPuzzlePooledProblem,
} from "@/games/fifteen-puzzle/problem/problem-pool";
import { hashProblemSeed, type ProblemSeed } from "@/games/problem-seed";

export function selectFifteenPuzzleProblemForDifficulty(
  difficulty: FifteenPuzzleDifficulty,
  seed: ProblemSeed,
): FifteenPuzzleGeneratedProblem {
  const entries = listFifteenPuzzlePoolEntries(difficulty);
  const entry = entries[hashProblemSeed(seed) % entries.length];
  if (!entry) {
    throw new Error(
      `No level ${difficulty} fifteen puzzle problem is available`,
    );
  }

  const { identity, optimalMoveCount } = toFifteenPuzzlePooledProblem(entry);
  return restoreFifteenPuzzleProblemWithOptimalMoveCount(
    identity,
    optimalMoveCount,
  );
}

/**
 * 記録・診断の識別情報から、問題集の最短手数付きで問題を復元する。
 * 問題集に無い識別情報では最短手数を決められないので `null` を返す。
 */
export function restoreFifteenPuzzlePooledProblem(
  identity: FifteenPuzzleProblemIdentity,
): FifteenPuzzleGeneratedProblem | null {
  const optimalMoveCount = findFifteenPuzzlePooledOptimalMoveCount(identity);
  return optimalMoveCount === null
    ? null
    : restoreFifteenPuzzleProblemWithOptimalMoveCount(
        identity,
        optimalMoveCount,
      );
}
