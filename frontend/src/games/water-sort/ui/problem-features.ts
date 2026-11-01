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

/** 絞り込みでは、レベルにある値の種類が多いとき、色の数は3種類ごと、空ボトルの数は2本ごとにまとめる。 */
export const waterSortProblemFeatureAxisDisplays = {
  "color-count": {
    label: "色",
    valueFormat: { kind: "count", unit: "種類", rangeWidth: 3 },
  },
  "empty-bottle-count": {
    label: "空ボトル",
    valueFormat: { kind: "count", unit: "本", rangeWidth: 2 },
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
