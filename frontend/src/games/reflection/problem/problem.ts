import {
  isRecordedProblemIdentity,
  type RecordedProblemIdentity,
} from "@/games/problem-id";
import type { ProblemSeed } from "@/games/problem-seed";
import {
  assertReflectionBoard,
  countReflectionBoardPieces,
  isSameReflectionInventory,
  type ReflectionBoard,
  type ReflectionInventory,
} from "@/games/reflection/puzzle/board";
import {
  areSameReflectionClues,
  computeReflectionClues,
  type ReflectionClue,
} from "@/games/reflection/puzzle/laser";
import {
  isNonEmptyString,
  isNonNegativeInteger,
  isRecordObject,
} from "@/lib/type-guards";

export type ReflectionProblem = {
  size: number;
  inventory: ReflectionInventory;
  /** 外周ヒントの並びは `listReflectionEntries` に従う。 */
  clues: readonly ReflectionClue[];
  solution: ReflectionBoard;
};

/** どのレベルでどの大きさを出すかは `reflectionLevelCombinations` が決める。 */
export const reflectionBoardSizes = [5, 6, 7, 8, 9, 10, 11] as const;

export type ReflectionBoardSize = (typeof reflectionBoardSizes)[number];

/** 生成手順を変えて同じ identity から別の問題ができるようになったら上げる。 */
export const REFLECTION_GENERATOR_VERSION = "3";

export type ReflectionGenerationConditions = {
  size: ReflectionBoardSize;
  pieceCount: number;
};

export type ReflectionProblemIdentity = {
  generatorVersion: typeof REFLECTION_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: ReflectionGenerationConditions;
};

export type ReflectionRecordedProblemIdentity = RecordedProblemIdentity;

export type ReflectionIdentifiedProblem = {
  problem: ReflectionProblem;
  identity: ReflectionProblemIdentity;
};

/**
 * - `propagationRoundCount`: 人間向け解法器で、全外周ヒントへ照らし直して候補が変わった回数。
 * - `assumptionTestCount`: 人間向け解法器で、候補を仮に置いて確かめた回数（推論レベル5 でだけ増える）。
 * - `trialMoveCount`: 一致表示を見ながら1本ずつ満たす試し置きで解き切った手数。解き切れない問題は `null`。
 */
export type ReflectionSolveWorkload = {
  pieceCount: number;
  clueCount: number;
  propagationRoundCount: number;
  assumptionTestCount: number;
  trialMoveCount: number | null;
};

export function createReflectionProblemIdentity(
  size: ReflectionBoardSize,
  pieceCount: number,
  candidateIndex: number,
): ReflectionProblemIdentity {
  return {
    generatorVersion: REFLECTION_GENERATOR_VERSION,
    // seed は条件ごとに別の系列になるよう条件を含める。
    seed: `rf-${size}-${pieceCount}-${candidateIndex}`,
    conditions: { size, pieceCount },
  };
}

export function isReflectionBoardSize(
  value: unknown,
): value is ReflectionBoardSize {
  return reflectionBoardSizes.some((size) => size === value);
}

export function isReflectionPieceCount(
  size: ReflectionBoardSize,
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value < size * size
  );
}

export function assertReflectionProblem(problem: ReflectionProblem): void {
  assertReflectionBoard(problem.solution);

  if (problem.solution.size !== problem.size) {
    throw new RangeError("Reflection solution must match the problem size");
  }

  const solutionInventory = countReflectionBoardPieces(problem.solution);
  if (!isSameReflectionInventory(solutionInventory, problem.inventory)) {
    throw new Error("Reflection solution must use exactly the inventory");
  }

  if (
    !areSameReflectionClues(
      computeReflectionClues(problem.solution),
      problem.clues,
    )
  ) {
    throw new Error("Reflection clues must agree with the solution");
  }
}

export function isCurrentReflectionProblemIdentity(
  value: unknown,
): value is ReflectionProblemIdentity {
  if (!isRecordObject(value) || !isRecordObject(value.conditions)) {
    return false;
  }

  const { size, pieceCount } = value.conditions;
  return (
    value.generatorVersion === REFLECTION_GENERATOR_VERSION &&
    isNonEmptyString(value.seed) &&
    isReflectionBoardSize(size) &&
    isReflectionPieceCount(size, pieceCount)
  );
}

export function isReflectionSolveWorkload(
  value: unknown,
): value is ReflectionSolveWorkload {
  if (!isRecordObject(value)) {
    return false;
  }

  const {
    pieceCount,
    clueCount,
    propagationRoundCount,
    assumptionTestCount,
    trialMoveCount,
  } = value;
  // 外周ヒントは一辺ごとに盤面の一辺と同じ本数あるので、4の倍数になる。
  if (
    !(trialMoveCount === null || isNonNegativeInteger(trialMoveCount)) ||
    !isNonNegativeInteger(pieceCount) ||
    !isNonNegativeInteger(clueCount) ||
    !isNonNegativeInteger(propagationRoundCount) ||
    !isNonNegativeInteger(assumptionTestCount) ||
    clueCount === 0 ||
    clueCount % 4 !== 0
  ) {
    return false;
  }

  // 生成器の版が今と違う記録も読めるよう、盤面サイズは今の生成器の範囲に限らない。
  const size = clueCount / 4;
  return pieceCount >= 1 && pieceCount < size * size;
}

export function isReflectionWorkloadOfIdentity(
  workload: ReflectionSolveWorkload,
  identity: ReflectionProblemIdentity,
): boolean {
  return (
    workload.pieceCount === identity.conditions.pieceCount &&
    workload.clueCount === identity.conditions.size * 4
  );
}

export function isReflectionRecordedProblemIdentity(
  value: unknown,
): value is ReflectionRecordedProblemIdentity {
  return isRecordedProblemIdentity(value, {
    generatorVersion: REFLECTION_GENERATOR_VERSION,
    isProblemIdentity: isCurrentReflectionProblemIdentity,
  });
}
