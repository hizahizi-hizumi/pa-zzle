import type { FukumenzanProblem } from "@/games/fukumenzan/problem/problem";

/**
 * 遊び方とチュートリアルで見せる式。答えまで見せるので、問題集には同じ問題（`getFukumenzanSameProblemKey`）を入れない。
 * `howToPlay` は 198 + 882 = 1080 で解ける。
 */
export const fukumenzanGuideExampleProblems = {
  howToPlay: { addends: ["MRD", "DDX"], result: "MUDU" },
} as const satisfies Record<string, FukumenzanProblem>;
