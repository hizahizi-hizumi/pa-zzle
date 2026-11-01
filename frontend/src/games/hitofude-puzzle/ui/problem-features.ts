import {
  formatProblemFeatures,
  type ProblemFeature,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import {
  type HitofudePuzzleProblemFeatureAxisId,
  type HitofudePuzzleProblemFeatures,
  hitofudePuzzleProblemFeatureAxes,
} from "@/games/hitofude-puzzle/problem/problem-pool";

/** 絞り込みでは、レベルにある値の種類が多いとき、穴の数は3マスごとにまとめる。 */
export const hitofudePuzzleProblemFeatureAxisDisplays = {
  "board-size": { label: "盤面", valueFormat: { kind: "square-board-size" } },
  "hole-count": {
    label: "穴",
    valueFormat: { kind: "count", unit: "マス", rangeWidth: 3 },
  },
} as const satisfies Record<
  HitofudePuzzleProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

export function formatHitofudePuzzleProblemFeatures(
  features: HitofudePuzzleProblemFeatures,
): ProblemFeature[] {
  return formatProblemFeatures(
    features,
    hitofudePuzzleProblemFeatureAxes,
    hitofudePuzzleProblemFeatureAxisDisplays,
  );
}
