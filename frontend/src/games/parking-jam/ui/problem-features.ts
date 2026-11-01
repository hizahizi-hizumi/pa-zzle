import {
  formatProblemFeatures,
  type ProblemFeature,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import {
  type ParkingJamProblemFeatureAxisId,
  type ParkingJamProblemFeatures,
  parkingJamProblemFeatureAxes,
} from "@/games/parking-jam/problem/problem-pool";

/** 絞り込みでは、レベルにある値の種類が多いとき、車の台数は3台ごと、植え込みの数は2か所ごとにまとめる。 */
export const parkingJamProblemFeatureAxisDisplays = {
  "parking-lot-size": { label: "駐車場", valueFormat: { kind: "board-size" } },
  "vehicle-count": {
    label: "車",
    valueFormat: { kind: "count", unit: "台", rangeWidth: 3 },
  },
  "fixed-area-count": {
    label: "植え込み",
    valueFormat: { kind: "count", unit: "か所", rangeWidth: 2 },
  },
} as const satisfies Record<
  ParkingJamProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

/** 植え込みは、無い問題では示さない。 */
export function formatParkingJamProblemFeatures(
  features: ParkingJamProblemFeatures,
): ProblemFeature[] {
  const shownAxes = parkingJamProblemFeatureAxes.filter(
    ({ id }) => id !== "fixed-area-count" || features.fixedAreaCount > 0,
  );
  return formatProblemFeatures(
    features,
    shownAxes,
    parkingJamProblemFeatureAxisDisplays,
  );
}
