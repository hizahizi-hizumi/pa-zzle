import {
  formatProblemFeatures,
  type ProblemFeature,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import {
  type BridgesProblemFeatureAxisId,
  type BridgesProblemFeatures,
  bridgesProblemFeatureAxes,
} from "@/games/bridges/problem/problem-pool";

/** 絞り込みでは、レベルにある値の種類が多いとき、島の数は3個ごとにまとめる。 */
export const bridgesProblemFeatureAxisDisplays = {
  "board-size": { label: "盤面", valueFormat: { kind: "square-board-size" } },
  "island-count": {
    label: "島",
    valueFormat: { kind: "count", unit: "個", rangeWidth: 3 },
  },
} as const satisfies Record<
  BridgesProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

export function formatBridgesProblemFeatures(
  features: BridgesProblemFeatures,
): ProblemFeature[] {
  return formatProblemFeatures(
    features,
    bridgesProblemFeatureAxes,
    bridgesProblemFeatureAxisDisplays,
  );
}
