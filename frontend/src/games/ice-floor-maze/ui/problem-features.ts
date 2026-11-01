import {
  formatProblemFeatures,
  type ProblemFeature,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import {
  type IceFloorMazeProblemFeatureAxisId,
  type IceFloorMazeProblemFeatures,
  iceFloorMazeProblemFeatureAxes,
} from "@/games/ice-floor-maze/problem-features";

/** 盤面は正方形とは限らないので行と列で示す。要素の数は問題集の1レベルで値の種類が少ないので、範囲にまとめない。 */
export const iceFloorMazeProblemFeatureAxisDisplays = {
  "board-size": { label: "盤面", valueFormat: { kind: "board-size" } },
  "brittle-rock-count": {
    label: "もろい岩",
    valueFormat: { kind: "count", unit: "個" },
  },
  "thin-ice-count": {
    label: "薄い氷",
    valueFormat: { kind: "count", unit: "マス" },
  },
} as const satisfies Record<
  IceFloorMazeProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

/** もろい岩・薄い氷は、無い問題では示さない。 */
export function formatIceFloorMazeProblemFeatures(
  features: IceFloorMazeProblemFeatures,
): ProblemFeature[] {
  const shownAxes = iceFloorMazeProblemFeatureAxes.filter(
    ({ id }) =>
      (id !== "brittle-rock-count" || features.brittleRockCount > 0) &&
      (id !== "thin-ice-count" || features.thinIceCount > 0),
  );
  return formatProblemFeatures(
    features,
    shownAxes,
    iceFloorMazeProblemFeatureAxisDisplays,
  );
}
