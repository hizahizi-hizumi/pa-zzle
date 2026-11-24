import {
  formatProblemFeatures,
  type ProblemFeature,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import {
  type SolitaireProblemFeatureAxisId,
  type SolitaireProblemFeatures,
  solitaireProblemFeatureAxes,
} from "@/games/solitaire/problem/problem-pool";

/** どちらも0から十数枚まで広がるので、絞り込みでは3枚ごとにまとめる。0枚も値として出す。 */
export const solitaireProblemFeatureAxisDisplays = {
  "cards-above-ace": {
    label: "A の上の札",
    valueFormat: { kind: "count", unit: "枚", rangeWidth: 3 },
  },
  "cards-below-king": {
    label: "K の下の札",
    valueFormat: { kind: "count", unit: "枚", rangeWidth: 3 },
  },
} as const satisfies Record<
  SolitaireProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

export function formatSolitaireProblemFeatures(
  features: SolitaireProblemFeatures,
): ProblemFeature[] {
  return formatProblemFeatures(
    features,
    solitaireProblemFeatureAxes,
    solitaireProblemFeatureAxisDisplays,
  );
}
