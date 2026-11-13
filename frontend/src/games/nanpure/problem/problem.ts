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
import {
  isRecordedProblemIdentity,
  type RecordedProblemIdentity,
} from "@/games/problem-id";
import type { ProblemSeed } from "@/games/problem-seed";
import { isNonEmptyString, isRecordObject } from "@/lib/type-guards";

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

export type NanpureGenerationConditions = {
  /**
   * ヒントを減らすとき、解き切れることを保つのに使ってよい最も深い手筋。
   * `null` なら手筋で解き切れることは保たず、一意解であることだけを保つ（評価可能範囲の外の問題も作る）。
   * 生成された問題の難易度はこの値で決めず、できた問題を分析して決める。
   */
  removalTechniqueLimit: NanpureTechnique | null;
};

export type NanpureProblemIdentity = {
  generatorVersion: typeof NANPURE_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: NanpureGenerationConditions;
};

/** 記録に残した問題の識別情報。生成器の版が今と違う記録も読み込む。 */
export type NanpureRecordedProblemIdentity = RecordedProblemIdentity;

export type NanpureIdentifiedProblem = {
  problem: NanpureProblem;
  identity: NanpureProblemIdentity;
};

export function createNanpureProblemIdentity(
  removalTechniqueLimit: NanpureTechnique | null,
  candidateIndex: number,
): NanpureProblemIdentity {
  return {
    generatorVersion: NANPURE_GENERATOR_VERSION,
    // seed は条件ごとに別の系列になるよう条件を含める。
    seed: `np-${removalTechniqueLimit ?? "uniqueness"}-${candidateIndex}`,
    conditions: { removalTechniqueLimit },
  };
}

/** 記録など外部から読み戻した値を確かめる。 */
export function isCurrentNanpureProblemIdentity(
  value: unknown,
): value is NanpureProblemIdentity {
  if (!isRecordObject(value) || !isRecordObject(value.conditions)) {
    return false;
  }
  const { removalTechniqueLimit } = value.conditions;
  return (
    value.generatorVersion === NANPURE_GENERATOR_VERSION &&
    isNonEmptyString(value.seed) &&
    (removalTechniqueLimit === null ||
      nanpureTechniques.some(
        (technique) => technique === removalTechniqueLimit,
      ))
  );
}

export function isNanpureRecordedProblemIdentity(
  value: unknown,
): value is NanpureRecordedProblemIdentity {
  return isRecordedProblemIdentity(value, {
    generatorVersion: NANPURE_GENERATOR_VERSION,
    isProblemIdentity: isCurrentNanpureProblemIdentity,
  });
}
