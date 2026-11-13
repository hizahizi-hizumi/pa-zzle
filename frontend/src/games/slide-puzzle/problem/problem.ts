import {
  isRecordedProblemIdentity,
  type RecordedProblemIdentity,
} from "@/games/problem-id";
import type { ProblemSeed } from "@/games/problem-seed";
import {
  getSlidePuzzleBoardSize,
  isSlidePuzzleBoardSize,
  type SlidePuzzleBoard,
  type SlidePuzzleBoardSize,
} from "@/games/slide-puzzle/puzzle/state";
import {
  isNonEmptyString,
  isPositiveInteger,
  isRecordObject,
} from "@/lib/type-guards";

export const SLIDE_PUZZLE_GENERATOR_VERSION = "1";

export type SlidePuzzleGenerationConditions = {
  size: SlidePuzzleBoardSize;
  /** 完成盤面から打つランダムな合法手の数。 */
  scrambleLength: number;
};

export type SlidePuzzleProblem = {
  initialBoard: SlidePuzzleBoard;
};

export function assertSlidePuzzleProblem(problem: SlidePuzzleProblem): void {
  const { initialBoard } = problem;
  getSlidePuzzleBoardSize(initialBoard);

  const tiles = new Set(initialBoard);
  const hasEveryTileOnce =
    tiles.size === initialBoard.length &&
    initialBoard.every(
      (tile) =>
        Number.isInteger(tile) && tile >= 0 && tile < initialBoard.length,
    );
  if (!hasEveryTileOnce) {
    throw new Error("Slide puzzle board must place each tile exactly once");
  }
}

export type SlidePuzzleProblemIdentity = {
  generatorVersion: typeof SLIDE_PUZZLE_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: SlidePuzzleGenerationConditions;
};

export type SlidePuzzleIdentifiedProblem = {
  problem: SlidePuzzleProblem;
  identity: SlidePuzzleProblemIdentity;
};

export function isCurrentSlidePuzzleProblemIdentity(
  value: unknown,
): value is SlidePuzzleProblemIdentity {
  if (!isRecordObject(value) || !isRecordObject(value.conditions)) {
    return false;
  }

  return (
    value.generatorVersion === SLIDE_PUZZLE_GENERATOR_VERSION &&
    isNonEmptyString(value.seed) &&
    isSlidePuzzleBoardSize(value.conditions.size) &&
    isPositiveInteger(value.conditions.scrambleLength)
  );
}

export type SlidePuzzleRecordedProblemIdentity = RecordedProblemIdentity<{
  size: SlidePuzzleBoardSize;
}>;

export function isSlidePuzzleRecordedProblemIdentity(
  value: unknown,
): value is SlidePuzzleRecordedProblemIdentity {
  return (
    isRecordedProblemIdentity(value, {
      generatorVersion: SLIDE_PUZZLE_GENERATOR_VERSION,
      isProblemIdentity: isCurrentSlidePuzzleProblemIdentity,
    }) && isSlidePuzzleBoardSize(value.conditions.size)
  );
}
