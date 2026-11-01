import {
  formatProblemFeatures,
  type ProblemFeature,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import {
  type HamiltonianPathProblemFeatureAxisId,
  type HamiltonianPathProblemFeatures,
  hamiltonianPathProblemFeatureAxes,
} from "@/games/hamiltonian-path/problem/problem-pool";

export const hamiltonianPathProblemFeatureAxisDisplays = {
  "board-size": { label: "盤面", valueFormat: { kind: "square-board-size" } },
} as const satisfies Record<
  HamiltonianPathProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

export function formatHamiltonianPathProblemFeatures(
  features: HamiltonianPathProblemFeatures,
): ProblemFeature[] {
  return formatProblemFeatures(
    features,
    hamiltonianPathProblemFeatureAxes,
    hamiltonianPathProblemFeatureAxisDisplays,
  );
}
