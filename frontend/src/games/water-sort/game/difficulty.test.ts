import { describe, expect, test } from "vitest";
import {
  assessWaterSortDifficulty,
  calculateWaterSortDifficultyIndex,
  parseWaterSortDifficulty,
} from "./difficulty";
import type { WaterSortProblemFeatures } from "./solver";

const baseFeatures: WaterSortProblemFeatures = {
  shortestMoveCount: 0,
  initialLegalMoveCount: 0,
  initialDistinctChoiceCount: 0,
  averageDistinctChoiceCountOnSolution: 0,
  maximumDistinctChoiceCountOnSolution: 0,
  forcedChoiceRatio: 0,
  noEmptyBottleStateRatio: 0,
  longestNoEmptyBottleRun: 0,
};

describe("parseWaterSortDifficulty", () => {
  test.each(["easy", "normal", "hard"] as const)(
    "%s を定義済みの難易度として受理すること",
    (input) => {
      const result = parseWaterSortDifficulty(input);

      expect(result).toBe(input);
    },
  );

  test.each([undefined, "", "impossible"])(
    "%s を未定義の難易度として拒否すること",
    (input) => {
      const result = parseWaterSortDifficulty(input);

      expect(result).toBeUndefined();
    },
  );
});

describe("calculateWaterSortDifficultyIndex", () => {
  test("最短手数・平均分岐・空き容量圧力・強制手率を合成すること", () => {
    const features: WaterSortProblemFeatures = {
      ...baseFeatures,
      shortestMoveCount: 10,
      averageDistinctChoiceCountOnSolution: 4,
      noEmptyBottleStateRatio: 0.5,
      forcedChoiceRatio: 0.25,
    };

    const index = calculateWaterSortDifficultyIndex(features);

    expect(index).toBe(19.5);
  });
});

describe("assessWaterSortDifficulty", () => {
  test.each([
    [23.9, "easy"],
    [24, "normal"],
    [31.9, "normal"],
    [32, "hard"],
  ] as const)("難易度指数 %s を %s に分類すること", (index, expected) => {
    const features: WaterSortProblemFeatures = {
      ...baseFeatures,
      shortestMoveCount: index,
    };

    const assessment = assessWaterSortDifficulty(features);

    expect(assessment.difficulty).toBe(expected);
    expect(assessment.index).toBe(index);
  });
});
