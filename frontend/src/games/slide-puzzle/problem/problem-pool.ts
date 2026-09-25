import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import {
  SLIDE_PUZZLE_GENERATOR_VERSION,
  type SlidePuzzleProblemIdentity,
} from "@/games/slide-puzzle/problem/problem";
import problemPoolJson from "@/games/slide-puzzle/problem/problem-pool.json";
import type { SlidePuzzleBoardSize } from "@/games/slide-puzzle/puzzle/state";

export type SlidePuzzleProblemPoolEntry = readonly [
  seed: string,
  scrambleLength: number,
  optimalMoveCount: number,
];

type SlidePuzzleProblemPool = {
  generatorVersion: typeof SLIDE_PUZZLE_GENERATOR_VERSION;
  levels: Record<SlidePuzzleDifficulty, readonly SlidePuzzleProblemPoolEntry[]>;
};

type SlidePuzzlePooledProblem = {
  identity: SlidePuzzleProblemIdentity;
  optimalMoveCount: number;
};

const problemPool = problemPoolJson as unknown as SlidePuzzleProblemPool;
/** 問題集の問題はすべてこの盤面サイズで作っている。 */
const POOLED_BOARD_SIZE: SlidePuzzleBoardSize = 4;

export function toSlidePuzzlePooledProblem([
  seed,
  scrambleLength,
  optimalMoveCount,
]: SlidePuzzleProblemPoolEntry): SlidePuzzlePooledProblem {
  return {
    identity: {
      generatorVersion: SLIDE_PUZZLE_GENERATOR_VERSION,
      seed,
      conditions: { size: POOLED_BOARD_SIZE, scrambleLength },
    },
    optimalMoveCount,
  };
}

export function listSlidePuzzlePoolEntries(
  difficulty: SlidePuzzleDifficulty,
): readonly SlidePuzzleProblemPoolEntry[] {
  return problemPool.levels[difficulty];
}

/** 再プレイ・診断用。問題集に無い識別情報なら `null` を返す。 */
export function findSlidePuzzlePooledOptimalMoveCount(
  identity: SlidePuzzleProblemIdentity,
): number | null {
  if (
    identity.generatorVersion !== problemPool.generatorVersion ||
    identity.conditions.size !== POOLED_BOARD_SIZE
  ) {
    return null;
  }

  for (const entries of Object.values(problemPool.levels)) {
    const entry = entries.find(
      ([seed, scrambleLength]) =>
        seed === identity.seed &&
        scrambleLength === identity.conditions.scrambleLength,
    );
    if (entry) {
      return entry[2];
    }
  }
  return null;
}
