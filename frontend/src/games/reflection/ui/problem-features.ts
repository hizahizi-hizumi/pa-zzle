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

export const reflectionProblemFeatureAxisDisplays = {
  "board-size": { label: "盤面", valueFormat: { kind: "square-board-size" } },
  "piece-count": {
    label: "ピース",
    valueFormat: { kind: "count", unit: "個" },
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
