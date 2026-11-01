import {
  createBoardSizeFeature,
  createProblemCountFeature,
  type ProblemFeature,
} from "@/components/problem-features";
import type { ParkingJamProblemFeatures } from "@/games/parking-jam/problem/problem-pool";

/** 植え込みは、無い問題では示さない。 */
export function formatParkingJamProblemFeatures({
  rows,
  columns,
  vehicleCount,
  fixedAreaCount,
}: ParkingJamProblemFeatures): ProblemFeature[] {
  return [
    createBoardSizeFeature("駐車場", { rows, columns }),
    createProblemCountFeature("車", vehicleCount, "台"),
    ...(fixedAreaCount > 0
      ? [createProblemCountFeature("植え込み", fixedAreaCount, "か所")]
      : []),
  ];
}
