import {
  formatProblemFeatures,
  type ProblemFeature,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import {
  type NanpureProblemFeatureAxisId,
  type NanpureProblemFeatures,
  nanpureProblemFeatureAxes,
} from "@/games/nanpure/problem/problem-pool";

export const nanpureProblemFeatureAxisDisplays = {
  "clue-count": {
    label: "初期数字",
    valueFormat: { kind: "count", unit: "個" },
  },
} as const satisfies Record<
  NanpureProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

export function formatNanpureProblemFeatures(
  features: NanpureProblemFeatures,
): ProblemFeature[] {
  return formatProblemFeatures(
    features,
    nanpureProblemFeatureAxes,
    nanpureProblemFeatureAxisDisplays,
  );
}
