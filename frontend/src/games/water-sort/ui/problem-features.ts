import {
  createProblemCountFeature,
  type ProblemFeature,
} from "@/components/problem-features";
import type { WaterSortProblemFeatures } from "@/games/water-sort/problem/problem-pool";

export function formatWaterSortProblemFeatures({
  colorCount,
  emptyBottleCount,
}: WaterSortProblemFeatures): ProblemFeature[] {
  return [
    createProblemCountFeature("色", colorCount, "種類"),
    createProblemCountFeature("空ボトル", emptyBottleCount, "本"),
  ];
}
