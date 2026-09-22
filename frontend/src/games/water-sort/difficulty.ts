import type { WaterSortDifficultyAnalysis } from "@/games/water-sort/problem/difficulty-analysis";

export const waterSortDifficulties = [
  {
    id: "1",
    label: "難易度 1",
    description: "自然な進め方の多くが、そのまま順調に進みます",
  },
  {
    id: "2",
    label: "難易度 2",
    description: "順序を外しても解けますが、立て直しが必要になります",
  },
  {
    id: "3",
    label: "難易度 3",
    description: "一部で、先の状態まで考えて手を選ぶ必要があります",
  },
  {
    id: "4",
    label: "難易度 4",
    description: "将来行き止まる自然な手が、複数の局面に現れます",
  },
  {
    id: "5",
    label: "難易度 5",
    description: "可解性を保つ順序判断が、問題全体で継続して求められます",
  },
] as const;

export type WaterSortDifficulty = (typeof waterSortDifficulties)[number]["id"];

const legacyWaterSortDifficulties = [
  { id: "easy", label: "かんたん" },
  { id: "normal", label: "ふつう" },
  { id: "hard", label: "むずかしい" },
] as const;

/** 5段階へ移行する前の記録だけが持つ難易度。現在の1〜5へ読み替えない。 */
export type LegacyWaterSortDifficulty =
  (typeof legacyWaterSortDifficulties)[number]["id"];

export type WaterSortRecordedDifficulty =
  | WaterSortDifficulty
  | LegacyWaterSortDifficulty;

export type WaterSortDifficultyAssessment =
  | {
      status: "classified";
      difficulty: WaterSortDifficulty;
    }
  | {
      status: "unclassified";
      difficulty: null;
      reason: "analysis-incomplete" | "insufficient-decision-states";
    };

const requiredSampledDecisionStateCount = 5;
const levelOneMaximumDetourDecisionStateRatio = 0.2;
const levelThreeMaximumDeadEndDecisionStateRatio = 0.2;
const levelFourMaximumDeadEndDecisionStateRatio = 0.4;

export function parseWaterSortDifficulty(
  value: string | undefined,
): WaterSortDifficulty | undefined {
  return waterSortDifficulties.find((difficulty) => difficulty.id === value)
    ?.id;
}

export function parseWaterSortRecordedDifficulty(
  value: string | undefined,
): WaterSortRecordedDifficulty | undefined {
  return (
    parseWaterSortDifficulty(value) ??
    legacyWaterSortDifficulties.find((difficulty) => difficulty.id === value)
      ?.id
  );
}

export function getWaterSortDifficultyLabel(
  difficulty: WaterSortRecordedDifficulty,
): string {
  return (
    [...waterSortDifficulties, ...legacyWaterSortDifficulties].find(
      (option) => option.id === difficulty,
    )?.label ?? difficulty
  );
}

export function assessWaterSortDifficulty(
  analysis: WaterSortDifficultyAnalysis,
): WaterSortDifficultyAssessment {
  const choices = analysis.plausibleChoiceAnalysis;

  if (choices.unresolvedChoiceCount > 0) {
    return {
      status: "unclassified",
      difficulty: null,
      reason: "analysis-incomplete",
    };
  }

  if (choices.sampledDecisionStateCount < requiredSampledDecisionStateCount) {
    return {
      status: "unclassified",
      difficulty: null,
      reason: "insufficient-decision-states",
    };
  }

  if (choices.deadEndDecisionStateRatio === 0) {
    return {
      status: "classified",
      difficulty:
        choices.detourDecisionStateRatio <=
        levelOneMaximumDetourDecisionStateRatio
          ? "1"
          : "2",
    };
  }

  if (
    choices.deadEndDecisionStateRatio <=
    levelThreeMaximumDeadEndDecisionStateRatio
  ) {
    return { status: "classified", difficulty: "3" };
  }

  if (
    choices.deadEndDecisionStateRatio <=
    levelFourMaximumDeadEndDecisionStateRatio
  ) {
    return { status: "classified", difficulty: "4" };
  }

  return { status: "classified", difficulty: "5" };
}
