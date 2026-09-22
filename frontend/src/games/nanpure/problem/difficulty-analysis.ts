import {
  type NanpureHumanSolveFeatures,
  traceNanpureHumanSolve,
} from "@/games/nanpure/problem/generation/human-solver";
import type { NanpureBoard } from "@/games/nanpure/puzzle/board";

export type NanpureDifficultyAnalysis = {
  status: "supported" | "unsupported";
  features: NanpureHumanSolveFeatures;
};

export function analyzeNanpureDifficulty(
  board: NanpureBoard,
): NanpureDifficultyAnalysis {
  const solve = traceNanpureHumanSolve(board);

  return {
    status: solve.status === "stalled" ? "unsupported" : "supported",
    features: solve.features,
  };
}
