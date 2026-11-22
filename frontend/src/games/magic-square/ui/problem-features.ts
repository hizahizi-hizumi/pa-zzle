import {
  formatProblemFeatures,
  type ProblemFeature,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import {
  type MagicSquareProblemFeatureAxisId,
  type MagicSquareProblemFeatures,
  magicSquareProblemFeatureAxes,
} from "@/games/magic-square/problem/problem-pool";

export const magicSquareProblemFeatureAxisDisplays = {
  "board-size": {
    label: "盤面",
    valueFormat: { kind: "square-board-size" },
  },
  "given-count": {
    label: "最初の数",
    valueFormat: { kind: "count", unit: "個", rangeWidth: 3 },
  },
} as const satisfies Record<
  MagicSquareProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

export function formatMagicSquareProblemFeatures(
  features: MagicSquareProblemFeatures,
): ProblemFeature[] {
  return formatProblemFeatures(
    features,
    magicSquareProblemFeatureAxes,
    magicSquareProblemFeatureAxisDisplays,
  );
}
