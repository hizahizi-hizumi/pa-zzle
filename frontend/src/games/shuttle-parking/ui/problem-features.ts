import {
  formatProblemFeatures,
  type ProblemFeature,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import {
  type ShuttleParkingProblemFeatureAxisId,
  type ShuttleParkingProblemFeatures,
  shuttleParkingProblemFeatureAxes,
} from "@/games/shuttle-parking/problem-features";

export const shuttleParkingProblemFeatureAxisDisplays = {
  "lot-size": {
    label: "駐車場",
    valueFormat: { kind: "square-board-size" },
  },
  "bay-count": {
    label: "待機枠",
    valueFormat: { kind: "count", unit: "か所" },
  },
  // 16〜24人の9通りは選択肢が多いので、2人ごとにまとめる。
  "passenger-count": {
    label: "乗客",
    valueFormat: { kind: "count", unit: "人", rangeWidth: 2 },
  },
} as const satisfies Record<
  ShuttleParkingProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

export function formatShuttleParkingProblemFeatures(
  features: ShuttleParkingProblemFeatures,
): ProblemFeature[] {
  return formatProblemFeatures(
    features,
    shuttleParkingProblemFeatureAxes,
    shuttleParkingProblemFeatureAxisDisplays,
  );
}
