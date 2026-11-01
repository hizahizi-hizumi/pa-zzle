import {
  formatProblemFeatures,
  type ProblemFeature,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import {
  type MinesweeperProblemFeatureAxisId,
  type MinesweeperProblemFeatures,
  minesweeperProblemFeatureAxes,
} from "@/games/minesweeper/problem/problem-pool";

export const minesweeperProblemFeatureAxisDisplays = {
  "board-size": { label: "盤面", valueFormat: { kind: "board-size" } },
  "mine-count": { label: "地雷", valueFormat: { kind: "count", unit: "個" } },
} as const satisfies Record<
  MinesweeperProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

export function formatMinesweeperProblemFeatures(
  features: MinesweeperProblemFeatures,
): ProblemFeature[] {
  return formatProblemFeatures(
    features,
    minesweeperProblemFeatureAxes,
    minesweeperProblemFeatureAxisDisplays,
  );
}
