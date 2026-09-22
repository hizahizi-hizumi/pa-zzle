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
      techniqueCounts: { "naked-single": 25, "hidden-single": 0 },
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

describe("parseNanpureDifficulty", () => {
  const definedCases = ["easy", "normal", "hard"] as const;
  const undefinedCases = [undefined, "", "impossible"] as const;

  test.each(definedCases)(
    "%s を定義済みの難易度として受理すること",
    (input) => {
      const result = parseNanpureDifficulty(input);

      expect(result).toBe(input);
    },
  );

  test.each(undefinedCases)(
    "%s を未定義の難易度として拒否すること",
    (input) => {
      const result = parseNanpureDifficulty(input);

      expect(result).toBeUndefined();
    },
  );
});

describe("assessNanpureDifficulty", () => {
  const cases = [
    [createDifficultyAnalysis(14.6), "easy"],
    [createDifficultyAnalysis(14.59), "normal"],
    [createDifficultyAnalysis(9.37), "normal"],
    [createDifficultyAnalysis(9.36), "hard"],
  ] as const;
  const unsupportedAnalysis: NanpureDifficultyAnalysis = {
    ...createDifficultyAnalysis(9),
    status: "unsupported",
  };

  test.each(cases)(
    "入力解析 %s を %s と分類すること",
    (analysis, difficulty) => {
      const result = assessNanpureDifficulty(analysis);

      expect(result).toMatchObject({ status: "rated", difficulty });
    },
  );

  test("対応手筋で解き切れない問題へ難易度を付けないこと", () => {
    const result = assessNanpureDifficulty(unsupportedAnalysis);

    expect(result.status).toBe("unsupported");
    expect(result).not.toHaveProperty("difficulty");
  });
});
