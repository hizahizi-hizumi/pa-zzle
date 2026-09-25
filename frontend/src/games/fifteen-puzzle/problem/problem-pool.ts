import type { FifteenPuzzleDifficulty } from "@/games/fifteen-puzzle/difficulty";
import {
  FIFTEEN_PUZZLE_GENERATOR_VERSION,
  type FifteenPuzzleProblemIdentity,
} from "@/games/fifteen-puzzle/problem/problem";
import problemPoolJson from "@/games/fifteen-puzzle/problem/problem-pool.json";
import { FIFTEEN_PUZZLE_SIZE } from "@/games/fifteen-puzzle/puzzle/state";

export type FifteenPuzzleProblemPoolEntry = readonly [
  seed: string,
  scrambleLength: number,
  optimalMoveCount: number,
];

type FifteenPuzzleProblemPool = {
  generatorVersion: typeof FIFTEEN_PUZZLE_GENERATOR_VERSION;
  levels: Record<
    FifteenPuzzleDifficulty,
    readonly FifteenPuzzleProblemPoolEntry[]
  >;
};

type FifteenPuzzlePooledProblem = {
  identity: FifteenPuzzleProblemIdentity;
  optimalMoveCount: number;
};

const problemPool = problemPoolJson as unknown as FifteenPuzzleProblemPool;

export function toFifteenPuzzlePooledProblem([
  seed,
  scrambleLength,
  optimalMoveCount,
]: FifteenPuzzleProblemPoolEntry): FifteenPuzzlePooledProblem {
  return {
    identity: {
      generatorVersion: FIFTEEN_PUZZLE_GENERATOR_VERSION,
      seed,
      conditions: { size: FIFTEEN_PUZZLE_SIZE, scrambleLength },
    },
    optimalMoveCount,
  };
}

export function listFifteenPuzzlePoolEntries(
  difficulty: FifteenPuzzleDifficulty,
): readonly FifteenPuzzleProblemPoolEntry[] {
  return problemPool.levels[difficulty];
}

/** 再プレイ・診断用。問題集に無い識別情報なら `null` を返す。 */
export function findFifteenPuzzlePooledOptimalMoveCount(
  identity: FifteenPuzzleProblemIdentity,
): number | null {
  if (
    identity.generatorVersion !== problemPool.generatorVersion ||
    identity.conditions.size !== FIFTEEN_PUZZLE_SIZE
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
