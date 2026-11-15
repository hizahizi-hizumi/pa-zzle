import { useSearchParams } from "react-router";
import type { ProblemId } from "@/games/problem-id";

export function createProblemIdSearch(problemId: ProblemId): string {
  return `?${new URLSearchParams({ problem: problemId })}`;
}

/** ゲームホームの図鑑で開く問題は、URLから直接復元する。 */
export function useRequestedProblemId(): ProblemId | null {
  const [params] = useSearchParams();
  return params.get("problem");
}
