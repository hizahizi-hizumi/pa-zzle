import {
  createProblemCountFeature,
  type ProblemFeature,
} from "@/components/problem-features";
import type { NanpureProblemFeatures } from "@/games/nanpure/problem/problem-pool";

export function formatNanpureProblemFeatures({
  clueCount,
}: NanpureProblemFeatures): ProblemFeature[] {
  return [createProblemCountFeature("初期数字", clueCount, "個")];
}
