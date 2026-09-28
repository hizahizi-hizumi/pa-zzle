import {
  type NanpureTechnique,
  nanpureTechniques,
} from "@/games/nanpure/problem/technique";
import {
  assertNanpureBoard,
  type NanpureBoard,
  type NanpureSolution,
} from "@/games/nanpure/puzzle/board";
import { isNanpureSolved } from "@/games/nanpure/puzzle/rules";
import type { ProblemSeed } from "@/games/problem-seed";

/**
 * 1問を遊ぶためのデータ。
 * - `clues`: ヒント（初期配置）。数字があるマスは固定マスになる。
 * - `solution`: ただ1つの解。
 */
export type NanpureProblem = {
  clues: NanpureBoard;
  solution: NanpureSolution;
};

export function assertNanpureProblem(problem: NanpureProblem): void {
  assertNanpureBoard(problem.clues);
  assertNanpureBoard(problem.solution);

  if (!isNanpureSolved(problem.solution)) {
    throw new Error("Nanpure problem solution must be a solved board");
  }

  const cluesMatchSolution = problem.clues.every(
    (cell, cellIndex) => cell === null || cell === problem.solution[cellIndex],
  );
  if (!cluesMatchSolution) {
    throw new Error("Nanpure problem clues must match its solution");
  }
}

/** 生成手順を変えて同じ identity から別の問題ができるようになったら上げる。版 "1" はヒント数を指定した3段階の生成器で、その記録の問題は復元できない。 */
export const NANPURE_GENERATOR_VERSION = "2";

/**
 * 問題を作る条件。
 * - `removalTechniqueLimit`: ヒントを減らすとき、解き切れることを保つのに使ってよい最も深い手筋。
 *   `null` なら手筋で解き切れることは保たず、一意解であることだけを保つ（評価可能範囲の外の問題も作る）。
 *   生成された問題の難易度はこの値で決めず、できた問題を分析して決める。
 */
export type NanpureGenerationConditions = {
  removalTechniqueLimit: NanpureTechnique | null;
};

/** 同じ問題を再現するための情報。記録から同じ問題を引き直すときに使う。 */
export type NanpureProblemIdentity = {
  generatorVersion: typeof NANPURE_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: NanpureGenerationConditions;
};

/**
 * 記録に残した問題の識別情報。
 * 生成器の版が今と違う記録（3段階の生成器の版 "1" など）も読み込めるよう、版と生成条件の形は今の生成器に限らない。
 * 今の生成器で扱えるかは `isNanpureProblemIdentity` で確かめる。
 */
export type NanpureRecordedProblemIdentity = {
  generatorVersion: string;
  seed: ProblemSeed;
  conditions: Readonly<Record<string, unknown>>;
};

/** 問題と、それを再現するための情報。難易度分析を伴わない。 */
export type NanpureIdentifiedProblem = {
  problem: NanpureProblem;
  identity: NanpureProblemIdentity;
};

/**
 * 生成条件と候補番号から identity を作る。seed は条件ごとに別の系列になるよう条件を含める。
 * 例: 手筋の上限 `x-wing`・候補番号 160 は `np-x-wing-160`。一意解だけを保つ条件は `np-uniqueness-160`。
 */
export function createNanpureProblemIdentity(
  removalTechniqueLimit: NanpureTechnique | null,
  candidateIndex: number,
): NanpureProblemIdentity {
  return {
    generatorVersion: NANPURE_GENERATOR_VERSION,
    seed: `np-${removalTechniqueLimit ?? "uniqueness"}-${candidateIndex}`,
    conditions: { removalTechniqueLimit },
  };
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 記録など外部から読み戻した値が、現在の生成器で扱える識別情報かを確かめる。 */
export function isNanpureProblemIdentity(
  value: unknown,
): value is NanpureProblemIdentity {
  if (!isRecordObject(value) || !isRecordObject(value.conditions)) {
    return false;
  }
  const { removalTechniqueLimit } = value.conditions;
  return (
    value.generatorVersion === NANPURE_GENERATOR_VERSION &&
    typeof value.seed === "string" &&
    value.seed.length > 0 &&
    (removalTechniqueLimit === null ||
      nanpureTechniques.some(
        (technique) => technique === removalTechniqueLimit,
      ))
  );
}

/**
 * 記録から読み戻した値が、問題の識別情報として読めるかを確かめる。
 * 今の生成器の版なら、今の生成器で扱える識別情報であることまで確かめる。
 */
export function isNanpureRecordedProblemIdentity(
  value: unknown,
): value is NanpureRecordedProblemIdentity {
  if (!isRecordObject(value) || !isRecordObject(value.conditions)) {
    return false;
  }

  const { generatorVersion, seed } = value;
  if (generatorVersion === NANPURE_GENERATOR_VERSION) {
    return isNanpureProblemIdentity(value);
  }
  return (
    typeof generatorVersion === "string" &&
    generatorVersion.length > 0 &&
    typeof seed === "string" &&
    seed.length > 0
  );
}
