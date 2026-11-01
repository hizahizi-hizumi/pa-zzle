import type { NonogramGridSize } from "@/games/nonogram/puzzle/board";
import {
  areSameNonogramClues,
  computeNonogramClues,
  type NonogramClues,
} from "@/games/nonogram/puzzle/clue";
import {
  assertNonogramPattern,
  type NonogramPattern,
} from "@/games/nonogram/puzzle/pattern";
import {
  isRecordedProblemIdentity,
  type RecordedProblemIdentity,
} from "@/games/problem-id";
import type { ProblemSeed } from "@/games/problem-seed";
import { isNonEmptyString, isRecordObject } from "@/lib/type-guards";

/**
 * 1問を遊ぶためのデータ。
 * - `clues`: 行ヒントと列ヒント。
 * - `solution`: ただ1つの解。クリアの判定と完成の演出に使う。
 */
export type NonogramProblem = NonogramGridSize & {
  clues: NonogramClues;
  solution: NonogramPattern;
};

/**
 * 生成器が扱う盤面の大きさ。幅10列までの正方形か縦長に限る。
 * どのレベルでどの大きさを出すかは難易度の方針が決める。
 */
export const nonogramBoardSizes = [
  { width: 7, height: 7 },
  { width: 8, height: 8 },
  { width: 9, height: 9 },
  { width: 10, height: 10 },
  { width: 10, height: 12 },
  { width: 10, height: 13 },
  { width: 10, height: 15 },
] as const satisfies readonly NonogramGridSize[];

/** 図柄の候補で、平滑化の前に各マスを黒にする確率。 */
export const nonogramBlackProbabilities = [0.45, 0.5, 0.55, 0.6, 0.65] as const;

/** 図柄の候補を、周りの多数決で塊のまとまりへ寄せる回数。 */
export const nonogramSmoothingCounts = [0, 1, 2] as const;

/**
 * 図柄の作り方。
 * - `mirrored`: 左半分を右へ写して左右対称にする。
 */
export type NonogramPatternStyle = {
  blackProbability: (typeof nonogramBlackProbabilities)[number];
  smoothingCount: (typeof nonogramSmoothingCounts)[number];
  mirrored: boolean;
};

/** 図柄の作り方の全組み合わせ。黒の確率・平滑化の回数・左右対称の順に入れ子にして並べる。 */
export const nonogramPatternStyles: readonly NonogramPatternStyle[] =
  nonogramBlackProbabilities.flatMap((blackProbability) =>
    nonogramSmoothingCounts.flatMap((smoothingCount) =>
      [true, false].map((mirrored) => ({
        blackProbability,
        smoothingCount,
        mirrored,
      })),
    ),
  );

/** 生成手順を変えて同じ identity から別の問題ができるようになったら上げる。 */
export const NONOGRAM_GENERATOR_VERSION = "1";

export type NonogramGenerationConditions = NonogramGridSize &
  NonogramPatternStyle;

/** 同じ問題を再現するための情報。記録から同じ問題を引き直すときに使う。 */
export type NonogramProblemIdentity = {
  generatorVersion: typeof NONOGRAM_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: NonogramGenerationConditions;
};

/** 記録に残した問題の識別情報。生成器の版が今と違う記録も読み込む。 */
export type NonogramRecordedProblemIdentity = RecordedProblemIdentity;

/** 問題と、それを再現するための情報。 */
export type NonogramIdentifiedProblem = {
  problem: NonogramProblem;
  identity: NonogramProblemIdentity;
};

/**
 * 生成条件と候補番号から identity を作る。seed は条件ごとに別の系列になるよう条件を含める。
 * 例: 10×12・黒の確率 0.45・平滑化1回・左右対称なし・候補番号 3 は `ng-10x12-d0.45-s1-n-3`。
 */
export function createNonogramProblemIdentity(
  size: NonogramGridSize,
  style: NonogramPatternStyle,
  candidateIndex: number,
): NonogramProblemIdentity {
  const styleKey = `d${style.blackProbability.toFixed(2)}-s${style.smoothingCount}-${style.mirrored ? "m" : "n"}`;
  return {
    generatorVersion: NONOGRAM_GENERATOR_VERSION,
    seed: `ng-${size.width}x${size.height}-${styleKey}-${candidateIndex}`,
    conditions: {
      width: size.width,
      height: size.height,
      blackProbability: style.blackProbability,
      smoothingCount: style.smoothingCount,
      mirrored: style.mirrored,
    },
  };
}

/** 図柄からヒントを求めて問題にする。 */
export function createNonogramProblem(
  solution: NonogramPattern,
): NonogramProblem {
  assertNonogramPattern(solution);
  return {
    width: solution.width,
    height: solution.height,
    clues: computeNonogramClues(solution),
    solution,
  };
}

export function isNonogramBoardSize(width: unknown, height: unknown): boolean {
  return nonogramBoardSizes.some(
    (size) => size.width === width && size.height === height,
  );
}

function isNonogramPatternStyle(value: Record<string, unknown>): boolean {
  return nonogramPatternStyles.some(
    (style) =>
      style.blackProbability === value.blackProbability &&
      style.smoothingCount === value.smoothingCount &&
      style.mirrored === value.mirrored,
  );
}

export function assertNonogramProblem(problem: NonogramProblem): void {
  assertNonogramPattern(problem.solution);

  if (
    problem.solution.width !== problem.width ||
    problem.solution.height !== problem.height
  ) {
    throw new RangeError("Nonogram solution must match the problem size");
  }

  if (
    !areSameNonogramClues(computeNonogramClues(problem.solution), problem.clues)
  ) {
    throw new Error("Nonogram clues must agree with the solution");
  }
}

/** 記録など外部から読み戻した値が、現在の生成器で扱える識別情報かを確かめる。 */
export function isNonogramProblemIdentity(
  value: unknown,
): value is NonogramProblemIdentity {
  if (!isRecordObject(value) || !isRecordObject(value.conditions)) {
    return false;
  }

  const { conditions } = value;
  return (
    value.generatorVersion === NONOGRAM_GENERATOR_VERSION &&
    isNonEmptyString(value.seed) &&
    isNonogramBoardSize(conditions.width, conditions.height) &&
    isNonogramPatternStyle(conditions)
  );
}

/** 記録から読み戻した値が、問題の識別情報として読めるかを確かめる。 */
export function isNonogramRecordedProblemIdentity(
  value: unknown,
): value is NonogramRecordedProblemIdentity {
  return isRecordedProblemIdentity(value, {
    generatorVersion: NONOGRAM_GENERATOR_VERSION,
    isProblemIdentity: isNonogramProblemIdentity,
  });
}
