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

/** 絞り込みでは、レベルにある値の種類が多いとき、地雷の数は5個ごとにまとめる。 */
export const minesweeperProblemFeatureAxisDisplays = {
  "board-size": { label: "盤面", valueFormat: { kind: "board-size" } },
  "mine-count": {
    label: "地雷",
    valueFormat: { kind: "count", unit: "個", rangeWidth: 5 },
  },
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
