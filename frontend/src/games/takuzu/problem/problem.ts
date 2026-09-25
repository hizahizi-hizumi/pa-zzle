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

/**
 * 問題を解き切るのに要る作業の量。速さの基準時間を問題ごとに決めるのに使い、難易度の判定には使わない。
 * - `emptyCellCount`: 空きマスの数。置くタイルの数。
 * - `roundCount`: 人間向け解法器が解き切るまでの局面の数。次に確定できるマスを探し直す回数を表す。
 * - `lineReadingRoundCount`: そのうち、行・列全体を読む手筋（C 残り1個・D 重複の回避・E 一般の行候補）が要った局面の数。
 */
export type TakuzuSolveWorkload = {
  emptyCellCount: number;
  roundCount: number;
  lineReadingRoundCount: number;
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

// 生成器（解法器）をプレイ時の読み込みに含めないよう、手筋の名前だけをここで持つ。
const removalTechniqueLimits = {
  adjacency: true,
  "count-completion": true,
  "single-remaining": true,
  "duplicate-avoidance": true,
  "general-line": true,
} as const satisfies Record<TakuzuTechnique, true>;

function isRemovalTechniqueLimit(
  value: unknown,
): value is TakuzuTechnique | null {
  return (
    value === null ||
    (typeof value === "string" && Object.hasOwn(removalTechniqueLimits, value))
  );
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** 記録など外部から読み戻した値が、現在の生成器で扱える識別情報かを確かめる。 */
export function isTakuzuProblemIdentity(
  value: unknown,
): value is TakuzuProblemIdentity {
  if (!isRecordObject(value) || !isRecordObject(value.conditions)) {
    return false;
  }

  const { size, removalTechniqueLimit, extraGivenCount } = value.conditions;
  return (
    value.generatorVersion === TAKUZU_GENERATOR_VERSION &&
    typeof value.seed === "string" &&
    value.seed.length > 0 &&
    size === TAKUZU_BOARD_SIZE &&
    isRemovalTechniqueLimit(removalTechniqueLimit) &&
    isNonNegativeInteger(extraGivenCount)
  );
}

/** 記録など外部から読み戻した値が、8×8 の問題で成り立つ作業の量かを確かめる。 */
export function isTakuzuSolveWorkload(
  value: unknown,
): value is TakuzuSolveWorkload {
  if (!isRecordObject(value)) {
    return false;
  }

  const { emptyCellCount, roundCount, lineReadingRoundCount } = value;
  return (
    isNonNegativeInteger(emptyCellCount) &&
    emptyCellCount > 0 &&
    emptyCellCount <= TAKUZU_BOARD_SIZE * TAKUZU_BOARD_SIZE &&
    isNonNegativeInteger(roundCount) &&
    roundCount > 0 &&
    roundCount <= emptyCellCount &&
    isNonNegativeInteger(lineReadingRoundCount) &&
    lineReadingRoundCount <= roundCount
  );
}
