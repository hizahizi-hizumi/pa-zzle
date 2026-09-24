import {
  FIFTEEN_PUZZLE_SIZE,
  type FifteenPuzzleBoard,
} from "@/games/fifteen-puzzle/puzzle/state";
import type { ProblemSeed } from "@/games/problem-seed";

export const FIFTEEN_PUZZLE_GENERATOR_VERSION = "1";

export type FifteenPuzzleGenerationConditions = {
  size: typeof FIFTEEN_PUZZLE_SIZE;
  /** 完成盤面から打つランダムな合法手の数。 */
  scrambleLength: number;
};

export type FifteenPuzzleProblem = {
  initialBoard: FifteenPuzzleBoard;
};

export type FifteenPuzzleProblemIdentity = {
  generatorVersion: typeof FIFTEEN_PUZZLE_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: FifteenPuzzleGenerationConditions;
};

export type FifteenPuzzleGeneratedProblem = {
  problem: FifteenPuzzleProblem;
  identity: FifteenPuzzleProblemIdentity;
  /** 問題集に保存した最短手数。 */
  optimalMoveCount: number;
};

/** 記録・診断など外部から読み戻した値が、現在の生成器で復元できる識別情報かを確かめる。 */
export function isFifteenPuzzleProblemIdentity(
  value: unknown,
): value is FifteenPuzzleProblemIdentity {
  if (!isRecordObject(value) || !isRecordObject(value.conditions)) {
    return false;
  }

  const { scrambleLength } = value.conditions;
  return (
    value.generatorVersion === FIFTEEN_PUZZLE_GENERATOR_VERSION &&
    typeof value.seed === "string" &&
    value.conditions.size === FIFTEEN_PUZZLE_SIZE &&
    typeof scrambleLength === "number" &&
    Number.isInteger(scrambleLength) &&
    scrambleLength > 0
  );
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
