import {
  formatProblemFeatures,
  type ProblemFeature,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import {
  type HitofudePuzzleProblemFeatureAxisId,
  type HitofudePuzzleProblemFeatures,
  hitofudePuzzleProblemFeatureAxes,
} from "@/games/hitofude-puzzle/problem/problem-pool";

export const hitofudePuzzleProblemFeatureAxisDisplays = {
  "board-size": { label: "盤面", valueFormat: { kind: "square-board-size" } },
} as const satisfies Record<
  HitofudePuzzleProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

export function formatHitofudePuzzleProblemFeatures(
  features: HitofudePuzzleProblemFeatures,
): ProblemFeature[] {
  return formatProblemFeatures(
    features,
    hitofudePuzzleProblemFeatureAxes,
    hitofudePuzzleProblemFeatureAxisDisplays,
  );
}
