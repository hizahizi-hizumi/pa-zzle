import type {
  DifficultyAssessment,
  DifficultyLevel,
  NoAssessmentDetail,
} from "@/games/difficulty";
import type {
  TakuzuDifficultyAnalysis,
  TakuzuHumanSolveFeatures,
} from "@/games/takuzu/problem/difficulty-analysis";

export type TakuzuDifficulty = DifficultyLevel;

/**
 * - `out-of-range`: 分析できるが提供しない。`too-light` は、局所の形を数巡見るだけで解き終わり、次の一手を探す挑戦がほとんど無い。
 * - `unsupported`: 一意解だが、1本の行・列を読む手筋では解き切れず、挑戦の強さを評価できない。
 */
export type TakuzuDifficultyAssessment = DifficultyAssessment<{
  classified: NoAssessmentDetail;
  outOfRange: { reason: "too-light" };
  unsupported: NoAssessmentDetail;
  invalid: NoAssessmentDetail;
}>;

const minimumProvidedRoundCount = 4;
const minimumDuplicateAvoidanceRoundCountForDifficulty5 = 2;

export function classifyTakuzuChallengeDifficulty({
  deepestTechnique,
  duplicateAvoidanceRoundCount,
}: TakuzuHumanSolveFeatures): TakuzuDifficulty {
  switch (deepestTechnique) {
    case "general-line":
      return "5";
    case "duplicate-avoidance":
      return duplicateAvoidanceRoundCount >=
        minimumDuplicateAvoidanceRoundCountForDifficulty5
        ? "5"
        : "4";
    case "single-remaining":
      return "3";
    case "count-completion":
      return "2";
    case "adjacency":
    case null:
      return "1";
  }
}

export function assessTakuzuDifficulty(
  analysis: TakuzuDifficultyAnalysis,
): TakuzuDifficultyAssessment {
  switch (analysis.status) {
    case "invalid":
      return { status: "invalid" };
    case "unsupported":
      return { status: "unsupported" };
    case "analyzed":
      if (analysis.features.roundCount < minimumProvidedRoundCount) {
        return { status: "out-of-range", reason: "too-light" };
      }
      return {
        status: "classified",
        difficulty: classifyTakuzuChallengeDifficulty(analysis.features),
      };
  }
}
