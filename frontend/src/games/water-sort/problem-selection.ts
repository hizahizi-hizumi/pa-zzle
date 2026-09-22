import type { ProblemSeed } from "@/games/problem-seed";

import {
  assessWaterSortDifficulty,
  type WaterSortDifficulty,
} from "@/games/water-sort/difficulty";
import {
  generateWaterSortProblem,
  WaterSortGenerationExhaustedError,
} from "@/games/water-sort/problem/generator";
import type { WaterSortGeneratedProblem } from "@/games/water-sort/problem/problem";

const maximumAttemptsPerColorCount = 8;
const maximumExpandedStatesPerCandidate = 100_000;

const preferredColorCountsByDifficulty: Record<
  WaterSortDifficulty,
  readonly number[]
> = {
  easy: [4, 6],
  normal: [8, 6, 10],
  hard: [12, 10, 8],
};

export function generateWaterSortProblemForDifficulty(
  difficulty: WaterSortDifficulty,
  seed: ProblemSeed,
): WaterSortGeneratedProblem {
  for (const colorCount of preferredColorCountsByDifficulty[difficulty]) {
    try {
      return generateWaterSortProblem({
        seed,
        colorCount,
        maximumAttempts: maximumAttemptsPerColorCount,
        solverOptions: {
          maxExpandedStates: maximumExpandedStatesPerCandidate,
        },
        acceptCandidate: ({ difficultyAnalysis }) =>
          assessWaterSortDifficulty(difficultyAnalysis).difficulty ===
          difficulty,
      });
    } catch (error) {
      if (!(error instanceof WaterSortGenerationExhaustedError)) {
        throw error;
      }
    }
  }

  throw new Error(`Failed to generate a ${difficulty} water sort problem`);
}
