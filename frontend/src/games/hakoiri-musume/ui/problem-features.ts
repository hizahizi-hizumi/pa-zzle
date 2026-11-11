import {
  formatProblemFeatureCount,
  formatProblemFeatures,
  type ProblemFeature,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import {
  type HakoiriMusumeProblemFeatureAxisId,
  type HakoiriMusumeProblemFeatures,
  hakoiriMusumeProblemFeatureAxes,
} from "@/games/hakoiri-musume/problem/problem-pool";

export const hakoiriMusumeProblemFeatureAxisDisplays = {
  "horizontal-count": {
    label: "横長",
    valueFormat: { kind: "count", unit: "個" },
  },
  "small-count": { label: "小駒", valueFormat: { kind: "count", unit: "個" } },
  "empty-group-count": {
    label: "空きのかたまり",
    valueFormat: { kind: "count", unit: "か所" },
  },
} as const satisfies Record<
  HakoiriMusumeProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

/**
 * 図鑑の詳しい表示に出す特徴。絞り込みの軸の特徴に、軸にしない縦長の数を横長の次に、空きマスの数を小駒の次に添えて、駒の組と
 * 空きをすべて読めるようにする。
 */
export function formatHakoiriMusumeProblemFeatures(
  features: HakoiriMusumeProblemFeatures,
): ProblemFeature[] {
  const [horizontal, small, ...rest] = formatProblemFeatures(
    features,
    hakoiriMusumeProblemFeatureAxes,
    hakoiriMusumeProblemFeatureAxisDisplays,
  );
  return [
    ...(horizontal ? [horizontal] : []),
    {
      label: "縦長",
      value: formatProblemFeatureCount(features.verticalCount, "個"),
    },
    ...(small ? [small] : []),
    {
      label: "空き",
      value: formatProblemFeatureCount(features.emptyCellCount, "マス"),
    },
    ...rest,
  ];
}
