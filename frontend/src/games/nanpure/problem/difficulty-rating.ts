import type { NanpureDifficulty } from "../difficulty";
import type { NanpureBoard } from "../puzzle/board";
import {
  type NanpureDependencyFeatures,
  type NanpureHumanSolveFeatures,
  traceNanpureHumanSolve,
} from "./generation/human-solver";

export const NANPURE_DIFFICULTY_MODEL_VERSION = "dependency-v1";

export const NANPURE_DIFFICULTY_DEPENDENCY_THRESHOLDS = {
  hardMaximumMeanAvailablePlacementCount: 9.36,
  easyMinimumMeanAvailablePlacementCount: 14.6,
} as const;

export type RatedNanpureDifficulty = {
  status: "rated";
  modelVersion: typeof NANPURE_DIFFICULTY_MODEL_VERSION;
  difficulty: NanpureDifficulty;
  features: NanpureHumanSolveFeatures;
};

export type UnsupportedNanpureDifficulty = {
  status: "unsupported";
  modelVersion: typeof NANPURE_DIFFICULTY_MODEL_VERSION;
  features: NanpureHumanSolveFeatures;
};

export type NanpureDifficultyRating =
  | RatedNanpureDifficulty
  | UnsupportedNanpureDifficulty;

export function classifyNanpureDependency(
  dependency: NanpureDependencyFeatures,
): NanpureDifficulty {
  const { meanAvailablePlacementCount } = dependency;

  if (
    meanAvailablePlacementCount <=
    NANPURE_DIFFICULTY_DEPENDENCY_THRESHOLDS.hardMaximumMeanAvailablePlacementCount
  ) {
    return "hard";
  }

  if (
    meanAvailablePlacementCount >=
    NANPURE_DIFFICULTY_DEPENDENCY_THRESHOLDS.easyMinimumMeanAvailablePlacementCount
  ) {
    return "easy";
  }

  return "normal";
}

export function rateUniqueNanpureDifficulty(
  board: NanpureBoard,
): NanpureDifficultyRating {
  const solve = traceNanpureHumanSolve(board);

  if (solve.status === "stalled") {
    return {
      status: "unsupported",
      modelVersion: NANPURE_DIFFICULTY_MODEL_VERSION,
      features: solve.features,
    };
  }

  return {
    status: "rated",
    modelVersion: NANPURE_DIFFICULTY_MODEL_VERSION,
    difficulty: classifyNanpureDependency(solve.features.dependency),
    features: solve.features,
  };
}
