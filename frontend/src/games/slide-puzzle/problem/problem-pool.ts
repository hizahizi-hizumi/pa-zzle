import {
  createBoardSizeFeatureValue,
  type ProblemFeatureAxis,
} from "@/games/problem-feature";
import { createProblemPoolIndex, type ProblemId } from "@/games/problem-id";
import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import {
  SLIDE_PUZZLE_GENERATOR_VERSION,
  type SlidePuzzleIdentifiedProblem,
  type SlidePuzzleProblemIdentity,
} from "@/games/slide-puzzle/problem/problem";
import problemPoolJson from "@/games/slide-puzzle/problem/problem-pool.json";
import type { SlidePuzzleBoardSize } from "@/games/slide-puzzle/puzzle/state";

export type SlidePuzzleProblemPoolEntry = readonly [
  seed: string,
  boardSize: SlidePuzzleBoardSize,
  scrambleLength: number,
  optimalMoveCount: number,
];

type SlidePuzzleProblemPool = {
  generatorVersion: typeof SLIDE_PUZZLE_GENERATOR_VERSION;
  levels: Record<SlidePuzzleDifficulty, readonly SlidePuzzleProblemPoolEntry[]>;
};

type SlidePuzzleDecodedPoolEntry = {
  identity: SlidePuzzleProblemIdentity;
  optimalMoveCount: number;
};

export type SlidePuzzlePooledProblem = SlidePuzzleIdentifiedProblem & {
  optimalMoveCount: number;
};

const problemPool = problemPoolJson as unknown as SlidePuzzleProblemPool;

export function decodeSlidePuzzlePoolEntry([
  seed,
  boardSize,
  scrambleLength,
  optimalMoveCount,
]: SlidePuzzleProblemPoolEntry): SlidePuzzleDecodedPoolEntry {
  return {
    identity: {
      generatorVersion: SLIDE_PUZZLE_GENERATOR_VERSION,
      seed,
      conditions: { size: boardSize, scrambleLength },
    },
    optimalMoveCount,
  };
}

export function listSlidePuzzlePoolEntries(
  difficulty: SlidePuzzleDifficulty,
): readonly SlidePuzzleProblemPoolEntry[] {
  return problemPool.levels[difficulty];
}

const poolIndex = createProblemPoolIndex(
  problemPool.levels,
  (entry) => decodeSlidePuzzlePoolEntry(entry).identity,
);

/** 問題 ID を、問題集の並び順で返す。 */
export function listSlidePuzzlePoolProblemIds(
  difficulty: SlidePuzzleDifficulty,
): readonly ProblemId[] {
  return poolIndex.listProblemIds(difficulty);
}

/** 問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findSlidePuzzlePoolEntryByProblemId(
  difficulty: SlidePuzzleDifficulty,
  problemId: string,
): SlidePuzzleProblemPoolEntry | null {
  return poolIndex.findPositionById(difficulty, problemId)?.entry ?? null;
}

/** 診断用。 */
export function findSlidePuzzlePooledOptimalMoveCount(
  identity: SlidePuzzleProblemIdentity,
): number | null {
  if (identity.generatorVersion !== problemPool.generatorVersion) {
    return null;
  }

  for (const entries of Object.values(problemPool.levels)) {
    const entry = entries.find(
      ([seed, boardSize, scrambleLength]) =>
        seed === identity.seed &&
        boardSize === identity.conditions.size &&
        scrambleLength === identity.conditions.scrambleLength,
    );
    if (entry) {
      return entry[3];
    }
  }
  return null;
}

export type SlidePuzzleProblemFeatures = {
  boardSize: SlidePuzzleBoardSize;
};

export function findSlidePuzzlePoolProblemFeatures(
  difficulty: SlidePuzzleDifficulty,
  problemId: string,
): SlidePuzzleProblemFeatures | null {
  const entry = findSlidePuzzlePoolEntryByProblemId(difficulty, problemId);
  return entry ? { boardSize: entry[1] } : null;
}

export const slidePuzzleProblemFeatureAxes = [
  {
    id: "board-size",
    getValue({ boardSize }) {
      return createBoardSizeFeatureValue(boardSize, boardSize);
    },
  },
] as const satisfies readonly ProblemFeatureAxis<SlidePuzzleProblemFeatures>[];

export type SlidePuzzleProblemFeatureAxisId =
  (typeof slidePuzzleProblemFeatureAxes)[number]["id"];
