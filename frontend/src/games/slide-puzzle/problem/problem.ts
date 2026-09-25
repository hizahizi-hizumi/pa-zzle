import type { ProblemSeed } from "@/games/problem-seed";
import {
  isSlidePuzzleBoardSize,
  type SlidePuzzleBoard,
  type SlidePuzzleBoardSize,
} from "@/games/slide-puzzle/puzzle/state";

export const SLIDE_PUZZLE_GENERATOR_VERSION = "1";

export type SlidePuzzleGenerationConditions = {
  size: SlidePuzzleBoardSize;
  /** 完成盤面から打つランダムな合法手の数。 */
  scrambleLength: number;
};

export type SlidePuzzleProblem = {
  initialBoard: SlidePuzzleBoard;
};

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

  const { scrambleLength } = value.conditions;
  return (
    value.generatorVersion === SLIDE_PUZZLE_GENERATOR_VERSION &&
    typeof value.seed === "string" &&
    isSlidePuzzleBoardSize(value.conditions.size) &&
    typeof scrambleLength === "number" &&
    Number.isInteger(scrambleLength) &&
    scrambleLength > 0
  );
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
