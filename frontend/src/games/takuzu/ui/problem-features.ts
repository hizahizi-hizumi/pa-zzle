import {
  createProblemCountFeature,
  type ProblemFeature,
} from "@/components/problem-features";
import type { TakuzuProblemFeatures } from "@/games/takuzu/problem/problem-pool";

export function formatTakuzuProblemFeatures({
  givenCount,
}: TakuzuProblemFeatures): ProblemFeature[] {
  return [createProblemCountFeature("初期配置", givenCount, "マス")];
}
