import {
  assessIceFloorMazeDifficulty,
  isIceFloorMazeBoardShapeOfDifficulty,
  listIceFloorMazeBoardShapes,
} from "@/games/ice-floor-maze/difficulty";
import type {
  IceFloorMazeDifficultyAnalysis,
  IceFloorMazeDifficultyFeatures,
} from "@/games/ice-floor-maze/problem/difficulty-analysis";
import type { IceFloorMazeBoardShape } from "@/games/ice-floor-maze/problem/problem";

const baseFeatures: IceFloorMazeDifficultyFeatures = {
  optimalMoveCount: 4,
  optimalSolutionCount: 1,
  reachableStopCount: 20,
  approachPlanningDepth: 1,
  alignPlanningDepth: 1,
  trialMoveCount: 4,
  detourMoveCount: 1,
  goalPassingStopCount: 0,
  deadStopCount: 0,
};

function analyzed(
  shape: IceFloorMazeBoardShape,
  planningDepth: number,
  optimalMoveCount: number,
): IceFloorMazeDifficultyAnalysis {
  return {
    status: "analyzed",
    shape,
    planningDepth,
    strategies: ["approach"],
    features: { ...baseFeatures, optimalMoveCount },
  };
}

function unsupported(
  shape: IceFloorMazeBoardShape,
  optimalMoveCount: number,
): IceFloorMazeDifficultyAnalysis {
  return {
    status: "unsupported",
    reason: "planning-depth-limit-exceeded",
    shape,
    features: {
      ...baseFeatures,
      optimalMoveCount,
      approachPlanningDepth: null,
      alignPlanningDepth: null,
    },
  };
}

const shape8x8 = { width: 8, height: 8 };
const shape8x10 = { width: 8, height: 10 };
const shape9x12 = { width: 9, height: 12 };
const shape10x13 = { width: 10, height: 13 };
const shape12x14 = { width: 12, height: 14 };

describe("assessIceFloorMazeDifficulty", () => {
  const classifiedCases = [
    ["8×8 で計画深さ1・最短3手", shape8x8, 1, 3, "1"],
    ["8×10 で計画深さ1・最短4手", shape8x10, 1, 4, "1"],
    ["8×10 で計画深さ1・最短5手", shape8x10, 1, 5, "2"],
    ["9×12 で計画深さ2・最短3手", shape9x12, 2, 3, "2"],
    ["9×12 で計画深さ3", shape9x12, 3, 6, "3"],
    ["10×13 で計画深さ3", shape10x13, 3, 4, "3"],
    ["10×13 で計画深さ4", shape10x13, 4, 5, "4"],
    ["12×14 で計画深さ4", shape12x14, 4, 8, "4"],
    ["12×14 で計画深さ5", shape12x14, 5, 7, "5"],
    ["12×14 で計画深さ6・最短14手", shape12x14, 6, 14, "5"],
  ] as const;
  const classifiedAnalyses = classifiedCases.map(
    ([name, shape, planningDepth, optimalMoveCount, difficulty]) =>
      [
        name,
        analyzed(shape, planningDepth, optimalMoveCount),
        planningDepth,
        difficulty,
      ] as const,
  );

  test.each(classifiedAnalyses)(
    "計画深さ・最短手数・盤面の形の組をレベルへ分類すること: %s",
    (_, analysis, planningDepth, difficulty) => {
      const assessment = assessIceFloorMazeDifficulty(analysis);

      expect(assessment).toEqual({
        status: "classified",
        difficulty,
        planningDepth,
      });
    },
  );

  const unlistedCases = [
    ["8×8 で計画深さ1・最短5手", analyzed(shape8x8, 1, 5), 1, shape8x8],
    ["8×8 で計画深さ3", analyzed(shape8x8, 3, 5), 3, shape8x8],
    ["12×14 で計画深さ1", analyzed(shape12x14, 1, 3), 1, shape12x14],
    ["10×13 で計画深さ5", analyzed(shape10x13, 5, 7), 5, shape10x13],
  ] as const;

  test.each(unlistedCases)(
    "どのレベルの組にも当たらない問題を提供範囲外とすること: %s",
    (_, analysis, planningDepth, shape) => {
      const assessment = assessIceFloorMazeDifficulty(analysis);

      expect(assessment).toEqual({
        status: "out-of-range",
        reason: "unlisted-combination",
        planningDepth,
        shape,
      });
    },
  );

  const moveCountCases = [
    ["最短2手", analyzed(shape8x8, 1, 2), "too-light", 2],
    ["最短15手", analyzed(shape12x14, 5, 15), "too-long", 15],
    ["評価不能で最短15手", unsupported(shape12x14, 15), "too-long", 15],
  ] as const;

  test.each(moveCountCases)(
    "最短手数が提供範囲を外れる問題を、計画深さより先に提供範囲外とすること: %s",
    (_, analysis, reason, optimalMoveCount) => {
      const assessment = assessIceFloorMazeDifficulty(analysis);

      expect(assessment).toEqual({
        status: "out-of-range",
        reason,
        optimalMoveCount,
      });
    },
  );

  describe("読む手数の上限まで読んでも解けない場合", () => {
    const analysis = unsupported(shape12x14, 10);

    test("レベル5へ入れず評価不能とすること", () => {
      const assessment = assessIceFloorMazeDifficulty(analysis);

      expect(assessment).toEqual({
        status: "unsupported",
        reason: "planning-depth-limit-exceeded",
      });
    });
  });

  describe("ゴールへ止まれない場合", () => {
    const analysis: IceFloorMazeDifficultyAnalysis = {
      status: "invalid",
      reason: "goal-unreachable",
      shape: shape8x8,
    };

    test("成立しない問題とすること", () => {
      const assessment = assessIceFloorMazeDifficulty(analysis);

      expect(assessment).toEqual({
        status: "invalid",
        reason: "goal-unreachable",
      });
    });
  });
});

describe("isIceFloorMazeBoardShapeOfDifficulty", () => {
  const cases = [
    [shape8x8, "1", true],
    [shape8x10, "1", true],
    [shape8x10, "2", true],
    [shape9x12, "1", false],
    [shape10x13, "4", true],
    [shape10x13, "5", false],
    [shape12x14, "5", true],
  ] as const;

  test.each(cases)(
    "盤面の形がレベルで出す形かを返すこと: %o レベル %s",
    (shape, difficulty, expected) => {
      const result = isIceFloorMazeBoardShapeOfDifficulty(shape, difficulty);

      expect(result).toBe(expected);
    },
  );
});

describe("listIceFloorMazeBoardShapes", () => {
  test("どれかのレベルで出す形を重複なく狭い順に返すこと", () => {
    const shapes = listIceFloorMazeBoardShapes();

    expect(shapes).toEqual([
      shape8x8,
      shape8x10,
      shape9x12,
      shape10x13,
      shape12x14,
    ]);
  });
});
