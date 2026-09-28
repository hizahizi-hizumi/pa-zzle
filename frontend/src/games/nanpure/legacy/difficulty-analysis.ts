import {
  type NanpureLegacySingleSolveFeatures,
  traceNanpureLegacySingleSolve,
} from "@/games/nanpure/legacy/single-solver";
import type { NanpureBoard } from "@/games/nanpure/puzzle/board";

export type NanpureLegacyDifficultyAnalysis = {
  status: "supported" | "unsupported";
  features: NanpureLegacySingleSolveFeatures;
};

export function analyzeNanpureLegacyDifficulty(
  board: NanpureBoard,
): NanpureLegacyDifficultyAnalysis {
  const solve = traceNanpureLegacySingleSolve(board);

  return {
    status: solve.status === "stalled" ? "unsupported" : "supported",
    features: solve.features,
  };
}
