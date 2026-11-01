import {
  formatProblemFeatures,
  type ProblemFeature,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import {
  type ReflectionProblemFeatureAxisId,
  type ReflectionProblemFeatures,
  reflectionProblemFeatureAxes,
} from "@/games/reflection/problem/problem-pool";

/** 絞り込みでは、レベルにある値の種類が多いとき、ピースの数は4個ごとにまとめる。 */
export const reflectionProblemFeatureAxisDisplays = {
  "board-size": { label: "盤面", valueFormat: { kind: "square-board-size" } },
  "piece-count": {
    label: "ピース",
    valueFormat: { kind: "count", unit: "個", rangeWidth: 4 },
  },
} as const satisfies Record<
  ReflectionProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

export function formatReflectionProblemFeatures(
  features: ReflectionProblemFeatures,
): ProblemFeature[] {
  return formatProblemFeatures(
    features,
    reflectionProblemFeatureAxes,
    reflectionProblemFeatureAxisDisplays,
  );
}
