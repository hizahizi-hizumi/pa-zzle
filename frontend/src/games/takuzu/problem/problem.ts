import type { ProblemSeed } from "@/games/problem-seed";
import type { TakuzuTechnique } from "@/games/takuzu/problem/generation/human-solver";
import {
  assertTakuzuBoard,
  type TakuzuBoard,
} from "@/games/takuzu/puzzle/board";
import { isTakuzuSolved } from "@/games/takuzu/puzzle/rules";

/**
 * 1問を遊ぶためのデータ。
 * - `givens`: 初期配置。タイルがあるマスは固定マスになる。
 * - `solution`: ただ1つの解。
 */
export type TakuzuProblem = {
  givens: TakuzuBoard;
  solution: TakuzuBoard;
};

export const TAKUZU_BOARD_SIZE = 8;

/** 生成手順を変えて同じ identity から別の問題ができるようになったら上げる。 */
export const TAKUZU_GENERATOR_VERSION = "1";

/**
 * 問題を作る条件。
 * - `removalTechniqueLimit`: 初期配置を減らすとき、解き切れることを保つのに使ってよい最も深い手筋。
 *   `null` なら手筋で解き切れることは保たず、一意解であることだけを保つ（評価可能範囲の外の問題も作る）。
 *   生成された問題の難易度はこの値で決めず、できた問題を分析して決める。
 * - `extraGivenCount`: 減らし切った初期配置へ、解から戻すマスの数。初期配置が多めの問題を作るのに使う。
 */
export type TakuzuGenerationConditions = {
  size: typeof TAKUZU_BOARD_SIZE;
  removalTechniqueLimit: TakuzuTechnique | null;
  extraGivenCount: number;
};

/** 同じ問題を再現するための情報。記録から同じ問題を引き直すときに使う。 */
export type TakuzuProblemIdentity = {
  generatorVersion: typeof TAKUZU_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: TakuzuGenerationConditions;
};

/** 問題と、それを再現するための情報。難易度分析を伴わない。 */
export type TakuzuIdentifiedProblem = {
  problem: TakuzuProblem;
  identity: TakuzuProblemIdentity;
};

/**
 * 生成条件と候補番号から identity を作る。seed は条件ごとに別の系列になるよう条件を含める。
 * 例: 手筋の上限 `duplicate-avoidance`・戻す数 2・候補番号 160 は `tk-duplicate-avoidance-2-160`。
 */
export function createTakuzuProblemIdentity(
  removalTechniqueLimit: TakuzuTechnique | null,
  extraGivenCount: number,
  candidateIndex: number,
): TakuzuProblemIdentity {
  return {
    generatorVersion: TAKUZU_GENERATOR_VERSION,
    seed: `tk-${removalTechniqueLimit ?? "uniqueness"}-${extraGivenCount}-${candidateIndex}`,
    conditions: {
      size: TAKUZU_BOARD_SIZE,
      removalTechniqueLimit,
      extraGivenCount,
    },
  };
}

export function assertTakuzuProblem(problem: TakuzuProblem): void {
  assertTakuzuBoard(problem.givens);
  assertTakuzuBoard(problem.solution);

  if (problem.givens.size !== problem.solution.size) {
    throw new RangeError("Takuzu givens and solution must share a board size");
  }

  if (!isTakuzuSolved(problem.solution)) {
    throw new Error("Takuzu solution must satisfy every rule");
  }

  const contradictsSolution = problem.givens.cells.some(
    function contradicts(cell, cellIndex) {
      return cell !== null && cell !== problem.solution.cells[cellIndex];
    },
  );
  if (contradictsSolution) {
    throw new Error("Takuzu givens must agree with the solution");
  }
}
