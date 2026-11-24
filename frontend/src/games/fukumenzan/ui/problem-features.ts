import {
  formatProblemFeatures,
  type ProblemFeature,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import {
  type FukumenzanProblemFeatureAxisId,
  type FukumenzanProblemFeatures,
  fukumenzanProblemFeatureAxes,
} from "@/games/fukumenzan/problem/problem-pool";

export const fukumenzanProblemFeatureAxisDisplays = {
  "letter-count": {
    label: "文字",
    valueFormat: { kind: "count", unit: "種類" },
  },
  "same-letter-column-count": {
    label: "同じ文字の桁",
    valueFormat: { kind: "count", unit: "か所" },
  },
} as const satisfies Record<
  FukumenzanProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

export function formatFukumenzanProblemFeatures(
  features: FukumenzanProblemFeatures,
): ProblemFeature[] {
  return formatProblemFeatures(
    features,
    fukumenzanProblemFeatureAxes,
    fukumenzanProblemFeatureAxisDisplays,
  );
}
