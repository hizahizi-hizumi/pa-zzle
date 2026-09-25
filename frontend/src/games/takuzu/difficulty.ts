import type {
  TakuzuDifficultyAnalysis,
  TakuzuHumanSolveFeatures,
} from "@/games/takuzu/problem/difficulty-analysis";

export const takuzuDifficulties = [
  { id: "1", label: "難易度 1" },
  { id: "2", label: "難易度 2" },
  { id: "3", label: "難易度 3" },
  { id: "4", label: "難易度 4" },
  { id: "5", label: "難易度 5" },
] as const;

export type TakuzuDifficulty = (typeof takuzuDifficulties)[number]["id"];

export function parseTakuzuDifficulty(
  value: string | undefined,
): TakuzuDifficulty | undefined {
  return takuzuDifficulties.find((difficulty) => difficulty.id === value)?.id;
}

export function getTakuzuDifficultyLabel(difficulty: TakuzuDifficulty): string {
  return (
    takuzuDifficulties.find((option) => option.id === difficulty)?.label ??
    difficulty
  );
}

/**
 * 分析結果を難易度へ分類した結果。
 * - `classified`: 提供範囲内で、難易度が決まった。
 * - `out-of-range`: 分析できるが提供しない。`too-light` は、局所の形を数巡見るだけで解き終わり、次の一手を探す挑戦がほとんど無い。
 * - `unsupported`: 一意解だが、1本の行・列を読む手筋では解き切れず、挑戦の強さを評価できない。
 * - `invalid`: 解が無い、または2つ以上あり、問題として成立しない。
 */
export type TakuzuDifficultyAssessment =
  | { status: "classified"; difficulty: TakuzuDifficulty }
  | { status: "out-of-range"; reason: "too-light" }
  | { status: "unsupported" }
  | { status: "invalid" };

const minimumProvidedRoundCount = 4;
const minimumDuplicateAvoidanceRoundCountForDifficulty5 = 2;

/**
 * 解くのに要る読みの種類で難易度を決める。上の条件から順に判定する。
 * 5: 両方のタイルが2個以上残る行・列を読み比べる（E）か、完成済みの行・列との比較が2つの局面で要る。
 * 4: 完成済みの行・列との比較が1つの局面で要る。
 * 3: 片方のタイルが残り1個の行・列で、その置き場所を読む（C）。
 * 2: 行・列の個数を数えて埋める（B）。
 * 1: 並んだ2つ・挟まれた1つの形（A）だけで解ける。
 */
export function classifyTakuzuChallengeDifficulty(
  features: TakuzuHumanSolveFeatures,
): TakuzuDifficulty {
  const { roundCountByTechnique, duplicateAvoidanceRoundCount } = features;
  if (
    roundCountByTechnique["general-line"] > 0 ||
    duplicateAvoidanceRoundCount >=
      minimumDuplicateAvoidanceRoundCountForDifficulty5
  ) {
    return "5";
  }
  if (duplicateAvoidanceRoundCount > 0) {
    return "4";
  }
  if (roundCountByTechnique["single-remaining"] > 0) {
    return "3";
  }
  if (roundCountByTechnique["count-completion"] > 0) {
    return "2";
  }
  return "1";
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
