import {
  assessWaterSortDifficulty,
  parseWaterSortDifficulty,
} from "./difficulty";
import type { WaterSortDifficultyAnalysis } from "./problem/difficulty-analysis";

const baseAnalysis: WaterSortDifficultyAnalysis = {
  shortestMoveCount: 20,
  minimumMergeMoveCount: 18,
  preparationMoveCount: 2,
  preparationMoveRatio: 0.1,
  averageEmptyBottlePressure: 0.7,
  noEmptyBottleStateRatio: 0.5,
  longestNoEmptyBottleRun: 5,
  representativeChoiceRisk: {
    stateIndex: 8,
    progressRatio: 0.4,
    distinctChoiceCount: 8,
    evaluatedChoiceCount: 8,
    unresolvedChoiceCount: 0,
    optimalChoiceRatio: 0.5,
    detourChoiceRatio: 0.5,
    deadEndChoiceRatio: 0,
    maximumDetourMoves: 1,
  },
  plausibleChoiceSafety: {
    sampledDecisionStateCount: 5,
    evaluatedChoiceCount: 10,
    unresolvedChoiceCount: 0,
    deadEndChoiceCount: 0,
    deadEndDecisionStateCount: 0,
    deadEndDecisionStateRatio: 0,
    deadEndChoiceRatio: 0,
    minimumSolvableChoiceRatio: 1,
  },
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

describe("assessWaterSortDifficulty", () => {
  test("準備手数が少なく空き容量と誤手の代償に余裕がある問題を easy に分類すること", () => {
    const analysis: WaterSortDifficultyAnalysis = {
      ...baseAnalysis,
      preparationMoveCount: 2,
      averageEmptyBottlePressure: 0.6,
    };

    const assessment = assessWaterSortDifficulty(analysis);

    expect(assessment.difficulty).toBe("easy");
  });

  test("準備負荷と空き容量圧力が高く危険な誤手を含む問題を hard に分類すること", () => {
    const analysis: WaterSortDifficultyAnalysis = {
      ...baseAnalysis,
      preparationMoveCount: 4,
      averageEmptyBottlePressure: 0.82,
      representativeChoiceRisk: {
        ...baseAnalysis.representativeChoiceRisk,
        optimalChoiceRatio: 0.5,
        detourChoiceRatio: 0.25,
        deadEndChoiceRatio: 0.25,
      },
    };

    const assessment = assessWaterSortDifficulty(analysis);

    expect(assessment.difficulty).toBe("hard");
  });

  test("問題が長くても誤手の代償が小さい問題を hard に分類しないこと", () => {
    const analysis: WaterSortDifficultyAnalysis = {
      ...baseAnalysis,
      shortestMoveCount: 40,
      minimumMergeMoveCount: 36,
      preparationMoveCount: 4,
      preparationMoveRatio: 0.1,
      averageEmptyBottlePressure: 0.82,
      representativeChoiceRisk: {
        ...baseAnalysis.representativeChoiceRisk,
        optimalChoiceRatio: 0.75,
        detourChoiceRatio: 0.25,
        deadEndChoiceRatio: 0,
        maximumDetourMoves: 1,
      },
    };

    const assessment = assessWaterSortDifficulty(analysis);

    expect(assessment.difficulty).toBe("normal");
  });

  test("誤手解析に未解決の選択肢が残る問題を境界の難易度へ断定しないこと", () => {
    const analysis: WaterSortDifficultyAnalysis = {
      ...baseAnalysis,
      preparationMoveCount: 4,
      averageEmptyBottlePressure: 0.9,
      representativeChoiceRisk: {
        ...baseAnalysis.representativeChoiceRisk,
        unresolvedChoiceCount: 1,
        optimalChoiceRatio: 0.5,
        detourChoiceRatio: 0.25,
        deadEndChoiceRatio: 0.25,
      },
    };

    const assessment = assessWaterSortDifficulty(analysis);

    expect(assessment.difficulty).toBe("normal");
  });
});
