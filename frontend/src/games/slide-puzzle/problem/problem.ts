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

/** 初期盤面は、扱う盤面サイズのマス数を持ち、空白と各タイルを1つずつ並べる。 */
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

export type SlidePuzzleGeneratedProblem = {
  problem: SlidePuzzleProblem;
  identity: SlidePuzzleProblemIdentity;
  /** 問題集に保存した最短手数。 */
  optimalMoveCount: number;
};

/** 記録・診断など外部から読み戻した値が、現在の生成器で復元できる識別情報かを確かめる。 */
export function isSlidePuzzleProblemIdentity(
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

/** 記録に残した問題の識別情報。生成器の版が今と違う記録も、採点に使う盤面サイズが読めれば読み込む。 */
export type SlidePuzzleRecordedProblemIdentity = RecordedProblemIdentity<{
  size: SlidePuzzleBoardSize;
}>;

/** 記録から読み戻した値が、問題の識別情報として読めるかを確かめる。 */
export function isSlidePuzzleRecordedProblemIdentity(
  value: unknown,
): value is SlidePuzzleRecordedProblemIdentity {
  return (
    isRecordedProblemIdentity(value, {
      generatorVersion: SLIDE_PUZZLE_GENERATOR_VERSION,
      isProblemIdentity: isSlidePuzzleProblemIdentity,
    }) && isSlidePuzzleBoardSize(value.conditions.size)
  );
}
