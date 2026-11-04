import {
  formatProblemFeatures,
  type ProblemFeature,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import {
  type HakoiriMusumeProblemFeatureAxisId,
  type HakoiriMusumeProblemFeatures,
  hakoiriMusumeProblemFeatureAxes,
} from "@/games/hakoiri-musume/problem-features";

export const hakoiriMusumeProblemFeatureAxisDisplays = {
  "horizontal-count": {
    label: "横長",
    valueFormat: { kind: "count", unit: "個" },
  },
  "small-count": { label: "小駒", valueFormat: { kind: "count", unit: "個" } },
} as const satisfies Record<
  HakoiriMusumeProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

export function formatHakoiriMusumeProblemFeatures(
  features: HakoiriMusumeProblemFeatures,
): ProblemFeature[] {
  return formatProblemFeatures(
    features,
    hakoiriMusumeProblemFeatureAxes,
    hakoiriMusumeProblemFeatureAxisDisplays,
  );
}
