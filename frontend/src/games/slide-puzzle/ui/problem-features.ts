import {
  formatProblemFeatures,
  type ProblemFeature,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import {
  type SlidePuzzleProblemFeatureAxisId,
  type SlidePuzzleProblemFeatures,
  slidePuzzleProblemFeatureAxes,
} from "@/games/slide-puzzle/problem/problem-pool";

export const slidePuzzleProblemFeatureAxisDisplays = {
  "board-size": { label: "盤面", valueFormat: { kind: "square-board-size" } },
} as const satisfies Record<
  SlidePuzzleProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

export function formatSlidePuzzleProblemFeatures(
  features: SlidePuzzleProblemFeatures,
): ProblemFeature[] {
  return formatProblemFeatures(
    features,
    slidePuzzleProblemFeatureAxes,
    slidePuzzleProblemFeatureAxisDisplays,
  );
}
