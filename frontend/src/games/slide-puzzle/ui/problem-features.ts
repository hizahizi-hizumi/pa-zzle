import {
  createSquareBoardSizeFeature,
  type ProblemFeature,
} from "@/components/problem-features";
import type { SlidePuzzleProblemFeatures } from "@/games/slide-puzzle/problem/problem-pool";

export function formatSlidePuzzleProblemFeatures({
  boardSize,
}: SlidePuzzleProblemFeatures): ProblemFeature[] {
  return [createSquareBoardSizeFeature("盤面", boardSize)];
}
