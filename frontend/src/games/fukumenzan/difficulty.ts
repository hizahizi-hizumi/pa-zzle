import {
  type DifficultyAssessment,
  type DifficultyLevel,
  difficultyLevels,
  isInNumericRange,
  type NoAssessmentDetail,
  type NumericRange,
} from "@/games/difficulty";
import {
  analyzeFukumenzanDifficulty,
  type FukumenzanAnalysisScope,
  type FukumenzanDifficultyAnalysis,
  type FukumenzanReadingClass,
  type FukumenzanScale,
} from "@/games/fukumenzan/problem/difficulty-analysis";
import type { FukumenzanProblem } from "@/games/fukumenzan/problem/problem";

export type FukumenzanDifficulty = DifficultyLevel;

/**
 * 読みの段。`E1`・`E2` は読みの組 E の1桁の重さ、`H1` は読みの組 H1、`B1`・`B2` は読みの組 H2 で場合分けが1回・2回。
 */
export type FukumenzanReadingStage = "E1" | "E2" | "H1" | "B1" | "B2";

export type FukumenzanLevelCombination = {
  scale: FukumenzanScale;
  stage: FukumenzanReadingStage;
  letterCount: NumericRange;
};

/**
 * レベルごとの規模と読みの段の組。どの段も読みが1つ上がり、規模は下がらない。同じ読みの段でもほかの規模はどのレベルにも
 * 入れない（規模だけが違う段を作らず、レベルの中で文字の数が難易度の写しにならないようにする）。
 */
export const fukumenzanLevelCombinations = {
  "1": { scale: "2s", stage: "E1", letterCount: { minimum: 5, maximum: 7 } },
  "2": { scale: "3s", stage: "E2", letterCount: { minimum: 5, maximum: 9 } },
  "3": { scale: "3s", stage: "H1", letterCount: { minimum: 5, maximum: 9 } },
  "4": { scale: "3l", stage: "B1", letterCount: { minimum: 6, maximum: 9 } },
  "5": { scale: "3l", stage: "B2", letterCount: { minimum: 7, maximum: 9 } },
} as const satisfies Record<FukumenzanDifficulty, FukumenzanLevelCombination>;

const columnWeightStages: ReadonlySet<FukumenzanReadingStage> = new Set([
  "E1",
  "E2",
]);

const splitStages: ReadonlySet<FukumenzanReadingStage> = new Set(["B1", "B2"]);

function listScalesOfStages(
  stages: ReadonlySet<FukumenzanReadingStage>,
): ReadonlySet<FukumenzanScale> {
  return new Set(
    Object.values(fukumenzanLevelCombinations)
      .filter(({ stage }) => stages.has(stage))
      .map(({ scale }) => scale),
  );
}

/** 1桁の重さと場合分けの回数は、それで分けるレベルの規模でだけ測る。 */
export const fukumenzanAnalysisScope: FukumenzanAnalysisScope = {
  columnWeightScales: listScalesOfStages(columnWeightStages),
  splitScales: listScalesOfStages(splitStages),
};

export type FukumenzanAssessedFeatures = {
  scale: FukumenzanScale;
  readingClass: FukumenzanReadingClass;
  stage: FukumenzanReadingStage | null;
  letterCount: number;
};

/**
 * 提供範囲外の理由。
 * - `margin`: 読みの組の境（mE・mH）か、E1 と E2 の間。端の読み手で言い方が決まらない。
 * - `split-limit`: 場合分けが上限の回数を超えるか、枝が人の手18手より長い。
 * - `unlisted-combination`: 規模と読みの段の組がどのレベルにも無い。
 * - `letter-count`: 文字の数がそのレベルの範囲の外。
 */
export type FukumenzanOutOfRangeReason =
  | "margin"
  | "split-limit"
  | "unlisted-combination"
  | "letter-count";

export type FukumenzanDifficultyAssessment = DifficultyAssessment<{
  classified: { features: FukumenzanAssessedFeatures };
  outOfRange: {
    reason: FukumenzanOutOfRangeReason;
    features: FukumenzanAssessedFeatures;
  };
  unsupported: NoAssessmentDetail;
  invalid: NoAssessmentDetail;
}>;

function getStage(
  analysis: Extract<FukumenzanDifficultyAnalysis, { status: "analyzed" }>,
): FukumenzanReadingStage | null {
  switch (analysis.readingClass) {
    case "E":
      return analysis.columnWeight === "E1" || analysis.columnWeight === "E2"
        ? analysis.columnWeight
        : null;
    case "H1":
      return "H1";
    case "H2":
      return analysis.splitCount === 1
        ? "B1"
        : analysis.splitCount === 2
          ? "B2"
          : null;
    default:
      return null;
  }
}

function getOutOfRangeReason(
  analysis: Extract<FukumenzanDifficultyAnalysis, { status: "analyzed" }>,
  stage: FukumenzanReadingStage | null,
): FukumenzanOutOfRangeReason | null {
  const { readingClass, columnWeight, splitCount, scale } = analysis;
  if (
    readingClass === "mE" ||
    readingClass === "mH" ||
    columnWeight === "between"
  ) {
    return "margin";
  }
  if (splitCount === "exceeded") {
    return "split-limit";
  }
  const level = findLevel(scale.scale, stage);
  if (level === null) {
    return "unlisted-combination";
  }
  return isInNumericRange(
    scale.letterCount,
    fukumenzanLevelCombinations[level].letterCount,
  )
    ? null
    : "letter-count";
}

function findLevel(
  scale: FukumenzanScale,
  stage: FukumenzanReadingStage | null,
): FukumenzanDifficulty | null {
  return (
    difficultyLevels.find(
      ({ id }) =>
        fukumenzanLevelCombinations[id].scale === scale &&
        fukumenzanLevelCombinations[id].stage === stage,
    )?.id ?? null
  );
}

export function assessFukumenzanDifficulty(
  analysis: FukumenzanDifficultyAnalysis,
): FukumenzanDifficultyAssessment {
  switch (analysis.status) {
    case "invalid":
      return { status: "invalid" };
    case "unsupported":
      return { status: "unsupported" };
    case "analyzed": {
      const stage = getStage(analysis);
      const features: FukumenzanAssessedFeatures = {
        scale: analysis.scale.scale,
        readingClass: analysis.readingClass,
        stage,
        letterCount: analysis.scale.letterCount,
      };
      const reason = getOutOfRangeReason(analysis, stage);
      if (reason !== null) {
        return { status: "out-of-range", reason, features };
      }
      return {
        status: "classified",
        difficulty: findLevel(features.scale, stage)!,
        features,
      };
    }
  }
}

export function classifyFukumenzanProblem(
  problem: FukumenzanProblem,
): FukumenzanDifficultyAssessment {
  return assessFukumenzanDifficulty(
    analyzeFukumenzanDifficulty(problem, fukumenzanAnalysisScope),
  );
}
