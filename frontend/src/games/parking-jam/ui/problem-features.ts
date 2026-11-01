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

export const parkingJamProblemFeatureAxisDisplays = {
  "parking-lot-size": { label: "駐車場", valueFormat: { kind: "board-size" } },
  "vehicle-count": { label: "車", valueFormat: { kind: "count", unit: "台" } },
  "fixed-area-count": {
    label: "植え込み",
    valueFormat: { kind: "count", unit: "か所" },
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
