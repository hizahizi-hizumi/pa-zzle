import {
  formatProblemFeatures,
  type ProblemFeature,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import {
  type TakuzuProblemFeatureAxisId,
  type TakuzuProblemFeatures,
  takuzuProblemFeatureAxes,
} from "@/games/takuzu/problem/problem-pool";

export const takuzuProblemFeatureAxisDisplays = {
  "given-count": {
    label: "初期配置",
    valueFormat: { kind: "count", unit: "マス" },
  },
} as const satisfies Record<
  TakuzuProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

export function formatTakuzuProblemFeatures(
  features: TakuzuProblemFeatures,
): ProblemFeature[] {
  return formatProblemFeatures(
    features,
    takuzuProblemFeatureAxes,
    takuzuProblemFeatureAxisDisplays,
  );
}
