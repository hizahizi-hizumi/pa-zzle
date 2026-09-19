import type { NanpureDifficultyAnalysis } from "./problem/difficulty-analysis";

export const nanpureDifficulties = [
  {
    id: "easy",
    label: "かんたん",
  },
  {
    id: "normal",
    label: "ふつう",
  },
  {
    id: "hard",
    label: "むずかしい",
  },
] as const;

export type NanpureDifficulty = (typeof nanpureDifficulties)[number]["id"];

export const NANPURE_DIFFICULTY_MODEL_VERSION = "dependency-v1";

export const NANPURE_DIFFICULTY_DEPENDENCY_THRESHOLDS = {
  hardMaximumMeanAvailablePlacementCount: 9.36,
  easyMinimumMeanAvailablePlacementCount: 14.6,
} as const;

export type NanpureDifficultyAssessment =
  | {
      status: "rated";
      modelVersion: typeof NANPURE_DIFFICULTY_MODEL_VERSION;
      difficulty: NanpureDifficulty;
    }
  | {
      status: "unsupported";
      modelVersion: typeof NANPURE_DIFFICULTY_MODEL_VERSION;
    };

export function parseNanpureDifficulty(
  value: string | undefined,
): NanpureDifficulty | undefined {
  return nanpureDifficulties.find((difficulty) => difficulty.id === value)?.id;
}

export function getNanpureDifficultyLabel(
  difficulty: NanpureDifficulty,
): string {
  return (
    nanpureDifficulties.find((option) => option.id === difficulty)?.label ??
    difficulty
  );
}

export function assessNanpureDifficulty(
  analysis: NanpureDifficultyAnalysis,
): NanpureDifficultyAssessment {
  if (analysis.status === "unsupported") {
    return {
      status: "unsupported",
      modelVersion: NANPURE_DIFFICULTY_MODEL_VERSION,
    };
  }

  const { meanAvailablePlacementCount } = analysis.features.dependency;
  let difficulty: NanpureDifficulty = "normal";

  if (
    meanAvailablePlacementCount <=
    NANPURE_DIFFICULTY_DEPENDENCY_THRESHOLDS.hardMaximumMeanAvailablePlacementCount
  ) {
    difficulty = "hard";
  } else if (
    meanAvailablePlacementCount >=
    NANPURE_DIFFICULTY_DEPENDENCY_THRESHOLDS.easyMinimumMeanAvailablePlacementCount
  ) {
    difficulty = "easy";
  }

  return {
    status: "rated",
    modelVersion: NANPURE_DIFFICULTY_MODEL_VERSION,
    difficulty,
  };
}
