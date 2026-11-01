import {
  formatProblemFeatures,
  type ProblemFeature,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import {
  type TakuzuProblemFeatureAxisId,
  type TakuzuProblemFeatures,
  takuzuProblemFeatureAxes,
} from "@/games/takuzu/problem/problem-pool";

/** 絞り込みでは、レベルにある値の種類が多いとき、初期配置のマスの数は3マスごとにまとめる。 */
export const takuzuProblemFeatureAxisDisplays = {
  "given-count": {
    label: "初期配置",
    valueFormat: { kind: "count", unit: "マス", rangeWidth: 3 },
  },
} as const satisfies Record<
  TakuzuProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

export function formatTakuzuProblemFeatures(
  features: TakuzuProblemFeatures,
): ProblemFeature[] {
  return formatProblemFeatures(
    features,
    takuzuProblemFeatureAxes,
    takuzuProblemFeatureAxisDisplays,
  );
}
