import {
  assessNanpureLegacyDifficulty,
  parseNanpureLegacyDifficulty,
} from "@/games/nanpure/legacy/difficulty";
import type { NanpureLegacyDifficultyAnalysis } from "@/games/nanpure/legacy/difficulty-analysis";

function createDifficultyAnalysis(
  meanAvailablePlacementCount: number,
): NanpureLegacyDifficultyAnalysis {
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

describe("parseNanpureLegacyDifficulty", () => {
  const definedCases = ["easy", "normal", "hard"] as const;
  const undefinedCases = [undefined, "", "impossible"] as const;

  test.each(definedCases)(
    "%s を定義済みの難易度として受理すること",
    (input) => {
      const result = parseNanpureLegacyDifficulty(input);

      expect(result).toBe(input);
    },
  );

  test.each(undefinedCases)(
    "%s を未定義の難易度として拒否すること",
    (input) => {
      const result = parseNanpureLegacyDifficulty(input);

      expect(result).toBeUndefined();
    },
  );
});

describe("assessNanpureLegacyDifficulty", () => {
  const cases = [
    [14.6, "easy"],
    [14.59, "normal"],
    [9.37, "normal"],
    [9.36, "hard"],
  ] as const;
  const unsupportedAnalysis: NanpureLegacyDifficultyAnalysis = {
    ...createDifficultyAnalysis(9),
    status: "unsupported",
  };

  test.each(cases)(
    "平均の次の一手候補数 %s を %s と分類すること",
    (meanAvailablePlacementCount, difficulty) => {
      const analysis = createDifficultyAnalysis(meanAvailablePlacementCount);
      const result = assessNanpureLegacyDifficulty(analysis);

      expect(result).toMatchObject({ status: "rated", difficulty });
    },
  );

  test("対応手筋で解き切れない問題へ難易度を付けないこと", () => {
    const result = assessNanpureLegacyDifficulty(unsupportedAnalysis);

    expect(result.status).toBe("unsupported");
    expect(result).not.toHaveProperty("difficulty");
  });
});
