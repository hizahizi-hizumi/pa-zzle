import { describe, expect, test } from "vitest";

import { assessNanpureDifficulty, parseNanpureDifficulty } from "./difficulty";
import type { NanpureDifficultyAnalysis } from "./problem/difficulty-analysis";

function createDifficultyAnalysis(
  meanAvailablePlacementCount: number,
): NanpureDifficultyAnalysis {
  return {
    status: "supported",
    features: {
      stepCount: 25,
      usedTechniques: ["naked-single"],
      techniqueCounts: {
        "naked-single": 25,
        "hidden-single": 0,
      },
      solvedWithSupportedTechniques: true,
      dependency: {
        observedStepCount: 25,
        meanAvailablePlacementCount,
        minimumAvailablePlacementCount: 1,
        singleOptionStepCount: 1,
      },
    },
  };
}

test.each(["easy", "normal", "hard"] as const)(
  "%s を定義済みの難易度として受理すること",
  (input) => {
    const result = parseNanpureDifficulty(input);

    expect(result).toBe(input);
  },
);

test.each([undefined, "", "impossible"])(
  "%s を未定義の難易度として拒否すること",
  (input) => {
    const result = parseNanpureDifficulty(input);

    expect(result).toBeUndefined();
  },
);

describe("assessNanpureDifficulty", () => {
  test.each([
    [14.6, "easy"],
    [14.59, "normal"],
    [9.37, "normal"],
    [9.36, "hard"],
  ] as const)(
    "平均の次の一手候補数 %s を %s と分類すること",
    (meanAvailablePlacementCount, difficulty) => {
      const analysis = createDifficultyAnalysis(meanAvailablePlacementCount);

      const result = assessNanpureDifficulty(analysis);

      expect(result).toMatchObject({ status: "rated", difficulty });
    },
  );

  test("対応手筋で解き切れない解析結果へ難易度を付けないこと", () => {
    const analysis: NanpureDifficultyAnalysis = {
      ...createDifficultyAnalysis(9),
      status: "unsupported",
    };

    const result = assessNanpureDifficulty(analysis);

    expect(result.status).toBe("unsupported");
    expect(result).not.toHaveProperty("difficulty");
  });
});
