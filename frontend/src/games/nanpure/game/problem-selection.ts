import type { Seed } from "@/games/core/seed";

import type { NanpureDifficulty } from "./difficulty";
import {
  type GeneratedNanpureProblem,
  generateNanpureProblem,
  NanpureGenerationExhaustedError,
} from "./generator";

const MAXIMUM_ATTEMPTS_PER_CLUE_COUNT = 12;

const PREFERRED_CLUE_COUNTS_BY_DIFFICULTY: Record<
  NanpureDifficulty,
  readonly number[]
> = {
  easy: [40, 36, 32],
  normal: [32, 36, 28, 40],
  hard: [28, 24, 32],
};

export function generateNanpureProblemForDifficulty(
  difficulty: NanpureDifficulty,
  seed: Seed,
): GeneratedNanpureProblem {
  for (const clueCount of PREFERRED_CLUE_COUNTS_BY_DIFFICULTY[difficulty]) {
    try {
      return generateNanpureProblem({
        seed,
        clueCount,
        maximumAttempts: MAXIMUM_ATTEMPTS_PER_CLUE_COUNT,
        acceptCandidate: ({ difficultyRating }) =>
          difficultyRating.status === "rated" &&
          difficultyRating.difficulty === difficulty,
      });
    } catch (error) {
      if (!(error instanceof NanpureGenerationExhaustedError)) {
        throw error;
      }
    }
  }

  throw new Error(`Failed to generate a ${difficulty} Nanpure problem`);
}
