import {
  assessWaterSortDifficulty,
  parseWaterSortDifficulty,
} from "@/games/water-sort/difficulty";
import type { WaterSortDifficultyAnalysis } from "@/games/water-sort/problem/difficulty-analysis";

function createAnalysis({
  sampledDecisionStateCount = 5,
  unresolvedChoiceCount = 0,
  detourDecisionStateCount = 0,
  deadEndDecisionStateCount = 0,
}: {
  sampledDecisionStateCount?: number;
  unresolvedChoiceCount?: number;
  detourDecisionStateCount?: number;
  deadEndDecisionStateCount?: number;
} = {}): WaterSortDifficultyAnalysis {
  const evaluatedChoiceCount = 10;
  return {
    plausibleChoiceAnalysis: {
      sampledDecisionStateCount,
      singleChoiceDecisionStateCount: 2,
      ambiguousDecisionStateCount: Math.max(0, sampledDecisionStateCount - 2),
      evaluatedChoiceCount,
      unresolvedChoiceCount,
      optimalChoiceCount: evaluatedChoiceCount,
      detourChoiceCount: 0,
      deadEndChoiceCount: 0,
      detourDecisionStateCount,
      deadEndDecisionStateCount,
      ambiguousDecisionStateRatio:
        sampledDecisionStateCount === 0
          ? 0
          : Math.max(0, sampledDecisionStateCount - 2) /
            sampledDecisionStateCount,
      detourDecisionStateRatio:
        sampledDecisionStateCount === 0
          ? 0
          : detourDecisionStateCount / sampledDecisionStateCount,
      deadEndDecisionStateRatio:
        sampledDecisionStateCount === 0
          ? 0
          : deadEndDecisionStateCount / sampledDecisionStateCount,
      detourChoiceRatio: 0,
      deadEndChoiceRatio: 0,
      maximumDetourMoves: detourDecisionStateCount > 0 ? 1 : 0,
      minimumSolvableChoiceRatio: deadEndDecisionStateCount > 0 ? 0.5 : 1,
    },
  };
}

describe("parseWaterSortDifficulty", () => {
  test.each(["1", "2", "3", "4", "5"] as const)(
    "%s を定義済みの難易度として受理すること",
    (input) => {
      const result = parseWaterSortDifficulty(input);

      expect(result).toBe(input);
    },
  );

  test.each([undefined, "", "easy", "normal", "hard", "6"])(
    "%s を未定義の難易度として拒否すること",
    (input) => {
      const result = parseWaterSortDifficulty(input);

      expect(result).toBeUndefined();
    },
  );
});

describe("assessWaterSortDifficulty", () => {
  const cases = [
    [createAnalysis(), "1"],
    [createAnalysis({ detourDecisionStateCount: 2 }), "2"],
    [createAnalysis({ deadEndDecisionStateCount: 1 }), "3"],
    [createAnalysis({ deadEndDecisionStateCount: 2 }), "4"],
    [createAnalysis({ deadEndDecisionStateCount: 3 }), "5"],
  ] as const;

  test.each(cases)(
    "自然な選択結果の継続性を難易度 %s へ分類すること",
    (analysis, expectedDifficulty) => {
      const assessment = assessWaterSortDifficulty(analysis);

      expect(assessment).toEqual({
        status: "classified",
        difficulty: expectedDifficulty,
      });
    },
  );

  test("解析不能な自然な選択が残る問題を難易度へ押し込まないこと", () => {
    const analysis = createAnalysis({ unresolvedChoiceCount: 1 });

    const assessment = assessWaterSortDifficulty(analysis);

    expect(assessment).toEqual({
      status: "unclassified",
      difficulty: null,
      reason: "analysis-incomplete",
    });
  });

  test("校正に必要な判断局面数を満たさない問題を難易度へ押し込まないこと", () => {
    const analysis = createAnalysis({ sampledDecisionStateCount: 4 });

    const assessment = assessWaterSortDifficulty(analysis);

    expect(assessment).toEqual({
      status: "unclassified",
      difficulty: null,
      reason: "insufficient-decision-states",
    });
  });
});
