import {
  type DifficultyAssessment,
  type DifficultyLevel,
  difficultyLevels,
  isInNumericRange,
  type NumericRange,
} from "@/games/difficulty";
import type { IceFloorMazeDifficultyAnalysis } from "@/games/ice-floor-maze/problem/difficulty-analysis";
import { iceFloorMazeOptimalMoveCountRange } from "@/games/ice-floor-maze/problem/generator";
import type { IceFloorMazeBoardShape } from "@/games/ice-floor-maze/problem/problem";

export type IceFloorMazeDifficulty = DifficultyLevel;

/**
 * 計画深さ（止まる場所を何手先まで頭の中で繋ぐか）と最少手数の組。
 * 最少手数は、計画深さ1の問題を短い問題と長い問題に分けるときだけ絞る。
 */
export type IceFloorMazePlanningRequirement = {
  planningDepth: NumericRange;
  optimalMoveCount: NumericRange;
};

/**
 * 1つのレベルが求める組み合わせ。
 * - `planningRequirements`: どれか1つに当たればよい。レベルの挑戦の中身を決める。
 * - `boardShapes`: そのレベルで出す盤面の形（幅×高さ）。単独でレベルを決めず、上のレベルほど広い盤面まで許す。
 *   広い盤面では同じ計画深さでも各手で比べる止まり先が増え、先読みの負担が強まる。
 */
export type IceFloorMazeLevelCombination = {
  planningRequirements: readonly IceFloorMazePlanningRequirement[];
  boardShapes: readonly IceFloorMazeBoardShape[];
};

const boardShape8x8 = { width: 8, height: 8 } as const;
const boardShape8x10 = { width: 8, height: 10 } as const;
const boardShape9x12 = { width: 9, height: 12 } as const;
const boardShape10x13 = { width: 10, height: 13 } as const;
const boardShape12x14 = { width: 12, height: 14 } as const;

const anyProvidedMoveCount = iceFloorMazeOptimalMoveCountRange;

/**
 * 各レベルの組み合わせ。計画深さを主軸に1段ずつ上げ、盤面の形は隣のレベルと1つずつ重ねて、範囲の両端を下げない。
 * 重なった形では計画深さでレベルが分かれる。レベル5 は、レベル4 との差を比べる止まり先の多さでもつけるため、最も広い形だけにする。
 * 境界は人間の実プレイで確かめる前の暫定値。
 */
export const iceFloorMazeLevelCombinations = {
  "1": {
    planningRequirements: [
      {
        planningDepth: { minimum: 1, maximum: 1 },
        optimalMoveCount: { minimum: 3, maximum: 4 },
      },
    ],
    boardShapes: [boardShape8x8, boardShape8x10],
  },
  "2": {
    planningRequirements: [
      {
        planningDepth: { minimum: 1, maximum: 1 },
        optimalMoveCount: {
          minimum: 5,
          maximum: anyProvidedMoveCount.maximum,
        },
      },
      {
        planningDepth: { minimum: 2, maximum: 2 },
        optimalMoveCount: anyProvidedMoveCount,
      },
    ],
    boardShapes: [boardShape8x10, boardShape9x12],
  },
  "3": {
    planningRequirements: [
      {
        planningDepth: { minimum: 3, maximum: 3 },
        optimalMoveCount: anyProvidedMoveCount,
      },
    ],
    boardShapes: [boardShape9x12, boardShape10x13],
  },
  "4": {
    planningRequirements: [
      {
        planningDepth: { minimum: 4, maximum: 4 },
        optimalMoveCount: anyProvidedMoveCount,
      },
    ],
    boardShapes: [boardShape10x13, boardShape12x14],
  },
  "5": {
    planningRequirements: [
      {
        planningDepth: { minimum: 5, maximum: 6 },
        optimalMoveCount: anyProvidedMoveCount,
      },
    ],
    boardShapes: [boardShape12x14],
  },
} as const satisfies Record<
  IceFloorMazeDifficulty,
  IceFloorMazeLevelCombination
>;

/**
 * 分析結果を難易度へ分類した結果。
 * - `classified`: 提供範囲内で、組み合わせがいずれかのレベルに当たった。
 * - `out-of-range`: 評価できるが提供しない。`too-light` は最少手数が短すぎて読む余地が無い。
 *   `too-long` は最少手数が長すぎて作業の量が多いだけになりやすい。`unlisted-combination` は計画深さと盤面の形の組が
 *   どのレベルにも当たらない。
 * - `unsupported`: 先読みのプレイヤーが読む手数の上限まで読んでも解けず、挑戦の強さを評価できない。
 * - `invalid`: ゴールへ止まれず、問題として成立しない。
 */
export type IceFloorMazeDifficultyAssessment = DifficultyAssessment<{
  classified: { planningDepth: number };
  outOfRange:
    | { reason: "too-light" | "too-long"; optimalMoveCount: number }
    | {
        reason: "unlisted-combination";
        planningDepth: number;
        shape: IceFloorMazeBoardShape;
      };
  unsupported: { reason: "planning-depth-limit-exceeded" };
  invalid: { reason: "goal-unreachable" };
}>;

function isSameBoardShape(
  left: IceFloorMazeBoardShape,
  right: IceFloorMazeBoardShape,
): boolean {
  return left.width === right.width && left.height === right.height;
}

/** 盤面の形が、そのレベルで出す形か。 */
export function isIceFloorMazeBoardShapeOfDifficulty(
  shape: IceFloorMazeBoardShape,
  difficulty: IceFloorMazeDifficulty,
): boolean {
  return iceFloorMazeLevelCombinations[difficulty].boardShapes.some(
    (levelShape) => isSameBoardShape(levelShape, shape),
  );
}

/** どれかのレベルで出す盤面の形。狭い順。 */
export function listIceFloorMazeBoardShapes(): IceFloorMazeBoardShape[] {
  return difficultyLevels
    .flatMap(
      ({ id }): readonly IceFloorMazeBoardShape[] =>
        iceFloorMazeLevelCombinations[id].boardShapes,
    )
    .filter(
      (shape, index, shapes) =>
        shapes.findIndex((other) => isSameBoardShape(other, shape)) === index,
    );
}

function matchesLevelCombination(
  planningDepth: number,
  optimalMoveCount: number,
  shape: IceFloorMazeBoardShape,
  combination: IceFloorMazeLevelCombination,
): boolean {
  return (
    combination.boardShapes.some((levelShape) =>
      isSameBoardShape(levelShape, shape),
    ) &&
    combination.planningRequirements.some(
      (requirement) =>
        isInNumericRange(planningDepth, requirement.planningDepth) &&
        isInNumericRange(optimalMoveCount, requirement.optimalMoveCount),
    )
  );
}

export function assessIceFloorMazeDifficulty(
  analysis: IceFloorMazeDifficultyAnalysis,
): IceFloorMazeDifficultyAssessment {
  if (analysis.status === "invalid") {
    return { status: "invalid", reason: analysis.reason };
  }

  const { optimalMoveCount } = analysis.features;
  if (optimalMoveCount < iceFloorMazeOptimalMoveCountRange.minimum) {
    return { status: "out-of-range", reason: "too-light", optimalMoveCount };
  }
  if (optimalMoveCount > iceFloorMazeOptimalMoveCountRange.maximum) {
    return { status: "out-of-range", reason: "too-long", optimalMoveCount };
  }
  if (analysis.status === "unsupported") {
    return { status: "unsupported", reason: analysis.reason };
  }

  const { planningDepth, shape } = analysis;
  const difficulty = difficultyLevels.find(({ id }) =>
    matchesLevelCombination(
      planningDepth,
      optimalMoveCount,
      shape,
      iceFloorMazeLevelCombinations[id],
    ),
  )?.id;
  return difficulty
    ? { status: "classified", difficulty, planningDepth }
    : {
        status: "out-of-range",
        reason: "unlisted-combination",
        planningDepth,
        shape,
      };
}
