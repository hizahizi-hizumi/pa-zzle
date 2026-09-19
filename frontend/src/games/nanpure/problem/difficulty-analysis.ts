import type { NanpureBoard } from "../puzzle/board";
import {
  type NanpureHumanSolveFeatures,
  traceNanpureHumanSolve,
} from "../puzzle/human-solver";

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
