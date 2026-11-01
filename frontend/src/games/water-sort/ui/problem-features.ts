import {
  formatProblemFeatures,
  type ProblemFeature,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import {
  type WaterSortProblemFeatureAxisId,
  type WaterSortProblemFeatures,
  waterSortProblemFeatureAxes,
} from "@/games/water-sort/problem/problem-pool";

export const waterSortProblemFeatureAxisDisplays = {
  "color-count": { label: "色", valueFormat: { kind: "count", unit: "種類" } },
  "empty-bottle-count": {
    label: "空ボトル",
    valueFormat: { kind: "count", unit: "本" },
  },
} as const satisfies Record<
  WaterSortProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

export function formatWaterSortProblemFeatures(
  features: WaterSortProblemFeatures,
): ProblemFeature[] {
  return formatProblemFeatures(
    features,
    waterSortProblemFeatureAxes,
    waterSortProblemFeatureAxisDisplays,
  );
}
