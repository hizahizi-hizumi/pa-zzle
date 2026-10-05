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
 * 分析結果を難易度へ分類した結果。
 * - `classified`: 提供範囲内で、難易度が決まった。
 * - `out-of-range`: 分析できるが提供しない。`too-light` は、局所の形を数巡見るだけで解き終わり、次の一手を探す挑戦がほとんど無い。
 * - `unsupported`: 一意解だが、1本の行・列を読む手筋では解き切れず、挑戦の強さを評価できない。
 * - `invalid`: 解が無い、または2つ以上あり、問題として成立しない。
 */
export type TakuzuDifficultyAssessment = DifficultyAssessment<{
  classified: NoAssessmentDetail;
  outOfRange: { reason: "too-light" };
  unsupported: NoAssessmentDetail;
  invalid: NoAssessmentDetail;
}>;

const minimumProvidedRoundCount = 4;
const minimumDuplicateAvoidanceRoundCountForDifficulty5 = 2;

/**
 * 解くのに要った最も深い手筋で難易度を決める。重複の回避が最も深い問題だけ、それが要った局面の数で 4 と 5 に分ける。
 * 5: 両方のタイルが2個以上残る行・列を読み比べる（E）か、完成済みの行・列との比較（D）が2つ以上の局面で要る。
 * 4: 完成済みの行・列との比較（D）が1つの局面で要る。
 * 3: 片方のタイルが残り1個の行・列で、その置き場所を読む（C）。
 * 2: 行・列の個数を数えて埋める（B）。
 * 1: 並んだ2つ・挟まれた1つの形（A）だけで解ける。
 */
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
