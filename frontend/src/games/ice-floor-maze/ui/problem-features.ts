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
  "floor-count": { label: "床", valueFormat: { kind: "count", unit: "マス" } },
  "brittle-rock-count": {
    label: "もろい岩",
    valueFormat: { kind: "count", unit: "個" },
  },
  "thin-ice-count": {
    label: "薄い氷",
    valueFormat: { kind: "count", unit: "マス" },
  },
  "snow-count": { label: "雪", valueFormat: { kind: "count", unit: "マス" } },
  "sliding-block-count": {
    label: "滑る氷の塊",
    valueFormat: { kind: "count", unit: "個" },
  },
} as const satisfies Record<
  IceFloorMazeProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

const elementCountFeatureByAxis = {
  "floor-count": "floorCount",
  "brittle-rock-count": "brittleRockCount",
  "thin-ice-count": "thinIceCount",
  "snow-count": "snowCount",
  "sliding-block-count": "slidingBlockCount",
} as const satisfies Partial<
  Record<IceFloorMazeProblemFeatureAxisId, keyof IceFloorMazeProblemFeatures>
>;

function isElementCountAxis(
  id: IceFloorMazeProblemFeatureAxisId,
): id is keyof typeof elementCountFeatureByAxis {
  return Object.hasOwn(elementCountFeatureByAxis, id);
}

export function formatIceFloorMazeProblemFeatures(
  features: IceFloorMazeProblemFeatures,
): ProblemFeature[] {
  const shownAxes = iceFloorMazeProblemFeatureAxes.filter(
    ({ id }) =>
      !isElementCountAxis(id) || features[elementCountFeatureByAxis[id]] > 0,
  );
  return formatProblemFeatures(
    features,
    shownAxes,
    iceFloorMazeProblemFeatureAxisDisplays,
  );
}
