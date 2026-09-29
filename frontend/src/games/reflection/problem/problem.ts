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

/**
 * 1問を遊ぶためのデータ。
 * - `inventory`: 手持ちのピース。すべて盤面に置く。
 * - `clues`: 外周ヒント。並びは `listReflectionEntries` に従う。
 * - `solution`: ただ1つの解。
 */
export type ReflectionProblem = {
  size: number;
  inventory: ReflectionInventory;
  clues: readonly ReflectionClue[];
  solution: ReflectionBoard;
};

export const reflectionBoardSizes = [5, 6, 7] as const;

export type ReflectionBoardSize = (typeof reflectionBoardSizes)[number];

/** 生成手順を変えて同じ identity から別の問題ができるようになったら上げる。 */
export const REFLECTION_GENERATOR_VERSION = "2";

/** 問題を作る条件。`pieceCount` は手持ちのピースの総数。 */
export type ReflectionGenerationConditions = {
  size: ReflectionBoardSize;
  pieceCount: number;
};

/** 同じ問題を再現するための情報。記録から同じ問題を引き直すときに使う。 */
export type ReflectionProblemIdentity = {
  generatorVersion: typeof REFLECTION_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: ReflectionGenerationConditions;
};

/**
 * 記録に残した問題の識別情報。
 * 生成器の版が今と違う記録も読み戻せるよう、版と生成条件の形は今の生成器に限らない。
 * 今の生成器で扱えるかは `isReflectionProblemIdentity` で確かめる。
 */
export type ReflectionRecordedProblemIdentity = {
  generatorVersion: string;
  seed: ProblemSeed;
  conditions: Readonly<Record<string, unknown>>;
};

/** 問題と、それを再現するための情報。 */
export type ReflectionIdentifiedProblem = {
  problem: ReflectionProblem;
  identity: ReflectionProblemIdentity;
};

/**
 * 問題を解き切る作業の量。速さの基準時間を問題ごとに決めるために使い、難易度そのものは表さない。
 * - `pieceCount` / `clueCount`: 置くピースの数と、読む外周ヒントの本数。
 * - `propagationRoundCount`: 人間向け解法器で、全外周ヒントへ照らし直して候補が変わった回数。
 * - `assumptionTestCount`: 人間向け解法器で、候補を仮に置いて確かめた回数（推論レベル5 でだけ増える）。
 */
export type ReflectionSolveWorkload = {
  pieceCount: number;
  clueCount: number;
  propagationRoundCount: number;
  assumptionTestCount: number;
};

/**
 * 生成条件と候補番号から identity を作る。seed は条件ごとに別の系列になるよう条件を含める。
 * 例: 7×7・10ピース・候補番号 3 は `rf-7-10-3`。
 */
export function createReflectionProblemIdentity(
  size: ReflectionBoardSize,
  pieceCount: number,
  candidateIndex: number,
): ReflectionProblemIdentity {
  return {
    generatorVersion: REFLECTION_GENERATOR_VERSION,
    seed: `rf-${size}-${pieceCount}-${candidateIndex}`,
    conditions: { size, pieceCount },
  };
}

export function isReflectionBoardSize(
  value: unknown,
): value is ReflectionBoardSize {
  return reflectionBoardSizes.some((size) => size === value);
}

/** 盤面の一辺に対して置けるピース数か。少なくとも1つ置き、空きマスを1つは残す。 */
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

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 記録など外部から読み戻した値が、現在の生成器で扱える識別情報かを確かめる。 */
export function isReflectionProblemIdentity(
  value: unknown,
): value is ReflectionProblemIdentity {
  if (!isRecordObject(value) || !isRecordObject(value.conditions)) {
    return false;
  }

  const { size, pieceCount } = value.conditions;
  return (
    value.generatorVersion === REFLECTION_GENERATOR_VERSION &&
    typeof value.seed === "string" &&
    value.seed.length > 0 &&
    isReflectionBoardSize(size) &&
    isReflectionPieceCount(size, pieceCount)
  );
}

/**
 * 記録から読み戻した値が、問題の識別情報として読めるかを確かめる。
 * 今の生成器の版なら、今の生成器で扱える識別情報であることまで確かめる。
 */
export function isReflectionRecordedProblemIdentity(
  value: unknown,
): value is ReflectionRecordedProblemIdentity {
  if (!isRecordObject(value) || !isRecordObject(value.conditions)) {
    return false;
  }

  const { generatorVersion, seed } = value;
  if (generatorVersion === REFLECTION_GENERATOR_VERSION) {
    return isReflectionProblemIdentity(value);
  }
  return (
    typeof generatorVersion === "string" &&
    generatorVersion.length > 0 &&
    typeof seed === "string" &&
    seed.length > 0
  );
}
