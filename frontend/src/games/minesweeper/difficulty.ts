import type {
  MinesweeperDifficultyAnalysis,
  MinesweeperHumanSolveFeatures,
  MinesweeperScaleMetrics,
} from "./problem/difficulty-analysis";

export const minesweeperDifficulties = [
  { id: "1", label: "難易度 1" },
  { id: "2", label: "難易度 2" },
  { id: "3", label: "難易度 3" },
  { id: "4", label: "難易度 4" },
  { id: "5", label: "難易度 5" },
] as const;

export type MinesweeperDifficulty =
  (typeof minesweeperDifficulties)[number]["id"];

export function parseMinesweeperDifficulty(
  value: string | undefined,
): MinesweeperDifficulty | undefined {
  return minesweeperDifficulties.find((difficulty) => difficulty.id === value)
    ?.id;
}

/**
 * 分析結果を難易度へ分類した結果。
 * - `classified`: 提供範囲内で、難易度が決まった。
 * - `out-of-range`: 推測なしで解けるが、挑戦が薄すぎる（`too-light`）か重すぎる（`too-heavy`）ため提供しない。
 * - `unsupported` / `unsolvable`: 分析で難易度を評価できない、または推測が必要で成立しない。
 */
export type MinesweeperDifficultyAssessment =
  | { status: "classified"; difficulty: MinesweeperDifficulty }
  | { status: "out-of-range"; reason: "too-light" | "too-heavy" }
  | {
      status: "unsupported";
      reason: "technique-limit" | "computation-limit";
    }
  | { status: "unsolvable" };

const minimumProvidedRoundCount = 6;
const maximumProvidedInitialRevealedSafeCellRatio = 0.6;
const maximumProvidedInferenceWidth = 4;
const minimumOverlapEquivalentRoundCountForDifficulty4 = 2;

function isTooHeavy(features: MinesweeperHumanSolveFeatures): boolean {
  return (features.maximumInferenceWidth ?? 0) > maximumProvidedInferenceWidth;
}

function isTooLight(
  scale: MinesweeperScaleMetrics,
  features: MinesweeperHumanSolveFeatures,
): boolean {
  return (
    features.roundCount < minimumProvidedRoundCount ||
    scale.initialRevealedSafeCellRatio >
      maximumProvidedInitialRevealedSafeCellRatio
  );
}

function classifyChallenge(
  features: MinesweeperHumanSolveFeatures,
): MinesweeperDifficulty {
  if (features.chainedGroupRoundCount > 0) {
    return "5";
  }
  if (
    features.overlapEquivalentRoundCount >=
      minimumOverlapEquivalentRoundCountForDifficulty4 ||
    features.multiNumberTotalMineCountRoundCount > 0
  ) {
    return "4";
  }
  if (features.overlapEquivalentRoundCount > 0) {
    return "3";
  }
  if (features.containmentEquivalentRoundCount > 0) {
    return "2";
  }
  return "1";
}

export function assessMinesweeperDifficulty(
  analysis: MinesweeperDifficultyAnalysis,
): MinesweeperDifficultyAssessment {
  switch (analysis.status) {
    case "unsupported":
      return { status: "unsupported", reason: analysis.reason };
    case "unsolvable":
      return { status: "unsolvable" };
    case "analyzed":
      if (isTooHeavy(analysis.features)) {
        return { status: "out-of-range", reason: "too-heavy" };
      }
      if (isTooLight(analysis.scale, analysis.features)) {
        return { status: "out-of-range", reason: "too-light" };
      }
      return {
        status: "classified",
        difficulty: classifyChallenge(analysis.features),
      };
  }
}

export const _private = { classifyChallenge };
