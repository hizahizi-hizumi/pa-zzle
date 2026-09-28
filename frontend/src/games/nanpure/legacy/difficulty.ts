/**
 * 3段階（かんたん・ふつう・むずかしい）の `dependency-v1` 分類。
 * 5段階の分類（`@/games/nanpure/difficulty`）へ画面・記録を移すまでの間だけ残す。
 * `legacy/` 配下は、その移行が済んだら記録の読み替えに要るもの以外を消す。
 */
import type { NanpureLegacyDifficultyAnalysis } from "@/games/nanpure/legacy/difficulty-analysis";

export const nanpureLegacyDifficulties = [
  { id: "easy", label: "かんたん" },
  { id: "normal", label: "ふつう" },
  { id: "hard", label: "むずかしい" },
] as const;

export type NanpureLegacyDifficulty =
  (typeof nanpureLegacyDifficulties)[number]["id"];

export const NANPURE_LEGACY_DIFFICULTY_DEPENDENCY_THRESHOLDS = {
  hardMaximumMeanAvailablePlacementCount: 9.36,
  easyMinimumMeanAvailablePlacementCount: 14.6,
} as const;

export type NanpureLegacyDifficultyAssessment =
  | {
      status: "rated";
      difficulty: NanpureLegacyDifficulty;
    }
  | {
      status: "unsupported";
    };

export function parseNanpureLegacyDifficulty(
  value: string | undefined,
): NanpureLegacyDifficulty | undefined {
  return nanpureLegacyDifficulties.find((difficulty) => difficulty.id === value)
    ?.id;
}

export function getNanpureLegacyDifficultyLabel(
  difficulty: NanpureLegacyDifficulty,
): string {
  return (
    nanpureLegacyDifficulties.find((option) => option.id === difficulty)
      ?.label ?? difficulty
  );
}

export function assessNanpureLegacyDifficulty(
  analysis: NanpureLegacyDifficultyAnalysis,
): NanpureLegacyDifficultyAssessment {
  if (analysis.status === "unsupported") {
    return {
      status: "unsupported",
    };
  }

  const { meanAvailablePlacementCount } = analysis.features.dependency;
  let difficulty: NanpureLegacyDifficulty = "normal";

  if (
    meanAvailablePlacementCount <=
    NANPURE_LEGACY_DIFFICULTY_DEPENDENCY_THRESHOLDS.hardMaximumMeanAvailablePlacementCount
  ) {
    difficulty = "hard";
  } else if (
    meanAvailablePlacementCount >=
    NANPURE_LEGACY_DIFFICULTY_DEPENDENCY_THRESHOLDS.easyMinimumMeanAvailablePlacementCount
  ) {
    difficulty = "easy";
  }

  return {
    status: "rated",
    difficulty,
  };
}
