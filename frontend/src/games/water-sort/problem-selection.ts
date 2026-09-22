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

type WaterSortGenerationProfile = {
  colorCount: number;
  emptyBottleCount: number;
};

const maximumAttemptsPerProfile = 64;
const maximumExpandedStatesPerCandidate = 100_000;

const generationProfilesByDifficulty: Record<
  WaterSortDifficulty,
  readonly WaterSortGenerationProfile[]
> = {
  "1": [
    { colorCount: 4, emptyBottleCount: 2 },
    { colorCount: 6, emptyBottleCount: 2 },
  ],
  "2": [
    { colorCount: 4, emptyBottleCount: 2 },
    { colorCount: 6, emptyBottleCount: 2 },
  ],
  "3": [
    { colorCount: 4, emptyBottleCount: 1 },
    { colorCount: 5, emptyBottleCount: 1 },
  ],
  "4": [
    { colorCount: 4, emptyBottleCount: 1 },
    { colorCount: 5, emptyBottleCount: 1 },
    { colorCount: 6, emptyBottleCount: 1 },
  ],
  "5": [
    { colorCount: 4, emptyBottleCount: 1 },
    { colorCount: 5, emptyBottleCount: 1 },
    { colorCount: 6, emptyBottleCount: 1 },
  ],
};

export function generateWaterSortProblemForDifficulty(
  difficulty: WaterSortDifficulty,
  seed: ProblemSeed,
): WaterSortGeneratedProblem {
  for (const profile of generationProfilesByDifficulty[difficulty]) {
    try {
      return generateWaterSortProblem({
        seed,
        ...profile,
        maximumAttempts: maximumAttemptsPerProfile,
        solverOptions: {
          maxExpandedStates: maximumExpandedStatesPerCandidate,
        },
        acceptCandidate: ({ difficultyAnalysis }) => {
          const assessment = assessWaterSortDifficulty(difficultyAnalysis);
          return (
            assessment.status === "classified" &&
            assessment.difficulty === difficulty
          );
        },
      });
    } catch (error) {
      if (!(error instanceof WaterSortGenerationExhaustedError)) {
        throw error;
      }
    }
  }

  throw new Error(`Failed to generate a level ${difficulty} water sort problem`);
}
