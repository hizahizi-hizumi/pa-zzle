import {
  createProblemCountFeature,
  createSquareBoardSizeFeature,
  type ProblemFeature,
} from "@/components/problem-features";
import type { ReflectionProblemFeatures } from "@/games/reflection/problem/problem-pool";

export function formatReflectionProblemFeatures({
  size,
  pieceCount,
}: ReflectionProblemFeatures): ProblemFeature[] {
  return [
    createSquareBoardSizeFeature("盤面", size),
    createProblemCountFeature("ピース", pieceCount, "個"),
  ];
}
