import {
  assessMinesweeperDifficulty,
  parseMinesweeperDifficulty,
} from "./difficulty";
import type {
  MinesweeperDifficultyAnalysis,
  MinesweeperHumanSolveFeatures,
  MinesweeperScaleMetrics,
} from "./problem/difficulty-analysis";
import { minesweeperDifficultyReviewProblems } from "./problem/difficulty-review-problems";
import { restoreMinesweeperProblem } from "./problem/generator";

function analyzeReviewProblem(seed: string): MinesweeperDifficultyAnalysis {
  const reviewProblem = minesweeperDifficultyReviewProblems.find(
    (candidate) => candidate.identity.seed === seed,
  )!;
  return restoreMinesweeperProblem(reviewProblem.identity).difficultyAnalysis;
}

const providedScale: MinesweeperScaleMetrics = {
  cellCount: 100,
  mineCount: 15,
  mineDensity: 0.15,
  initialRevealedCellCount: 20,
  initialRevealedSafeCellRatio: 20 / 85,
  safeCellCountToReveal: 65,
};

const level1Features: MinesweeperHumanSolveFeatures = {
  highestDeductionLevel: 1,
  roundCountByDeductionLevel: { 1: 10, 2: 0, 3: 0, 4: 0, 5: 0 },
  overlapOrHarderRoundCount: 0,
  maximumInferenceWidth: 1,
  roundCount: 10,
  meanDiscoveryCount: 3,
  minimumDiscoveryCount: 1,
  singleDiscoveryRoundCount: 1,
  singleLocationRoundCount: 1,
  totalMineCountUsage: "none",
  maximumDiscoveryRowSpan: 3,
  maximumDiscoveryColumnSpan: 3,
  containmentEquivalentRoundCount: 0,
  overlapEquivalentRoundCount: 0,
  multiNumberTotalMineCountRoundCount: 0,
  chainedGroupRoundCount: 0,
};

describe("parseMinesweeperDifficulty", () => {
  const definedCases = ["1", "2", "3", "4", "5"] as const;
  const undefinedCases = [undefined, "", "0", "6", "easy"] as const;

  test.each(definedCases)(
    "%s を定義済みの難易度として受理すること",
    (input) => {
      const result = parseMinesweeperDifficulty(input);

      expect(result).toBe(input);
    },
  );

  test.each(undefinedCases)(
    "%s を未定義の難易度として拒否すること",
    (input) => {
      const result = parseMinesweeperDifficulty(input);

      expect(result).toBeUndefined();
    },
  );
});

describe("assessMinesweeperDifficulty", () => {
  describe("代表問題の場合", () => {
    const cases = [
      ["ms-10x10-15-125", "1"],
      ["ms-12x10-18-229", "2"],
      ["ms-10x10-15-846", "2"],
      ["ms-10x10-18-151", "3"],
      ["ms-10x10-15-819", "3"],
      ["ms-10x10-21-311", "3"],
      ["ms-10x10-18-377", "4"],
      ["ms-10x10-18-342", "4"],
      ["ms-10x10-23-351", "4"],
      ["ms-12x10-25-290", "5"],
      ["ms-14x10-25-224", "5"],
    ].map(
      ([seed, difficulty]) =>
        [seed!, analyzeReviewProblem(seed!), difficulty] as const,
    );

    test.each(cases)(
      "%s を難易度 %s に分類すること",
      (_seed, analysis, difficulty) => {
        const result = assessMinesweeperDifficulty(analysis);

        expect(result).toEqual({ status: "classified", difficulty });
      },
    );
  });

  describe("初期開示が広すぎる問題の場合", () => {
    const analysis = analyzeReviewProblem("ms-12x10-12-103");

    test("軽すぎる提供範囲外とすること", () => {
      const result = assessMinesweeperDifficulty(analysis);

      expect(result).toEqual({ status: "out-of-range", reason: "too-light" });
    });
  });

  describe("ラウンド数が少なすぎる問題の場合", () => {
    const analysis: MinesweeperDifficultyAnalysis = {
      status: "analyzed",
      scale: providedScale,
      features: { ...level1Features, roundCount: 5 },
    };

    test("軽すぎる提供範囲外とすること", () => {
      const result = assessMinesweeperDifficulty(analysis);

      expect(result).toEqual({ status: "out-of-range", reason: "too-light" });
    });
  });

  describe("5つの数字を同時に考える推論を含む問題の場合", () => {
    const analysis: MinesweeperDifficultyAnalysis = {
      status: "analyzed",
      scale: providedScale,
      features: {
        ...level1Features,
        maximumInferenceWidth: 5,
        chainedGroupRoundCount: 1,
      },
    };

    test("重すぎる提供範囲外とすること", () => {
      const result = assessMinesweeperDifficulty(analysis);

      expect(result).toEqual({ status: "out-of-range", reason: "too-heavy" });
    });
  });

  describe("分析で評価できない問題の場合", () => {
    const analysis: MinesweeperDifficultyAnalysis = {
      status: "unsupported",
      reason: "computation-limit",
      scale: providedScale,
    };

    test("評価不能として理由を返すこと", () => {
      const result = assessMinesweeperDifficulty(analysis);

      expect(result).toEqual({
        status: "unsupported",
        reason: "computation-limit",
      });
    });
  });

  describe("推測が必要な問題の場合", () => {
    const analysis: MinesweeperDifficultyAnalysis = {
      status: "unsolvable",
      scale: providedScale,
    };

    test("成立しない問題として返すこと", () => {
      const result = assessMinesweeperDifficulty(analysis);

      expect(result).toEqual({ status: "unsolvable" });
    });
  });
});
