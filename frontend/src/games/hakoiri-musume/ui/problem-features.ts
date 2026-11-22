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
import type { HakoiriMusumeExitSide } from "@/games/hakoiri-musume/puzzle/board";

export const hakoiriMusumeProblemFeatureAxisDisplays = {
  "board-size": { label: "盤", valueFormat: { kind: "board-size" } },
  "target-count": { label: "娘", valueFormat: { kind: "count", unit: "個" } },
  "exit-width": {
    label: "出口の幅",
    valueFormat: { kind: "count", unit: "マス" },
  },
  "bend-count": { label: "L字", valueFormat: { kind: "count", unit: "個" } },
  "wall-count": { label: "壁", valueFormat: { kind: "count", unit: "マス" } },
} as const satisfies Record<
  HakoiriMusumeProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

const exitSideLabels = {
  top: "上",
  right: "右",
  bottom: "下",
  left: "左",
} as const satisfies Record<HakoiriMusumeExitSide, string>;

/**
 * 図鑑の詳しい表示に出す特徴。絞り込みの軸の特徴（盤・娘・出口の幅・L字・壁）に、娘ごとの出口の辺と幅、軸にしない駒の組
 * （横長・縦長・小駒・2 × 2 の駒）と空きを添える。
 */
export function formatHakoiriMusumeProblemFeatures(
  features: HakoiriMusumeProblemFeatures,
): ProblemFeature[] {
  return [
    ...formatProblemFeatures(
      features,
      hakoiriMusumeProblemFeatureAxes,
      hakoiriMusumeProblemFeatureAxisDisplays,
    ),
    {
      label: "出口",
      value: features.exits
        .map(
          ({ side, width }) =>
            `${exitSideLabels[side]} ${formatProblemFeatureCount(width, "マス")}`,
        )
        .join("、"),
    },
    {
      label: "横長",
      value: formatProblemFeatureCount(features.horizontalCount, "個"),
    },
    {
      label: "縦長",
      value: formatProblemFeatureCount(features.verticalCount, "個"),
    },
    {
      label: "小駒",
      value: formatProblemFeatureCount(features.smallCount, "個"),
    },
    ...(features.squareCount > 0
      ? [
          {
            label: "大駒",
            value: formatProblemFeatureCount(features.squareCount, "個"),
          },
        ]
      : []),
    {
      label: "空き",
      value: formatProblemFeatureCount(features.emptyCellCount, "マス"),
    },
    {
      label: "空きのかたまり",
      value: formatProblemFeatureCount(features.emptyGroupCount, "か所"),
    },
  ];
}
