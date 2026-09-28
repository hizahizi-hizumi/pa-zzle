import {
  assessNanpureLegacyDifficulty,
  type NanpureLegacyDifficulty,
} from "@/games/nanpure/legacy/difficulty";
import {
  generateNanpureLegacyProblem,
  NanpureLegacyGenerationExhaustedError,
} from "@/games/nanpure/legacy/generator";
import type { NanpureLegacyGeneratedProblem } from "@/games/nanpure/legacy/problem";
import type { ProblemSeed } from "@/games/problem-seed";

const MAXIMUM_ATTEMPTS_PER_CLUE_COUNT = 12;

const PREFERRED_CLUE_COUNTS_BY_DIFFICULTY: Record<
  NanpureLegacyDifficulty,
  readonly number[]
> = {
  easy: [40, 36, 32],
  normal: [32, 36, 28, 40],
  hard: [28, 24, 32],
};

export function generateNanpureLegacyProblemForDifficulty(
  difficulty: NanpureLegacyDifficulty,
  seed: ProblemSeed,
): NanpureLegacyGeneratedProblem {
  for (const clueCount of PREFERRED_CLUE_COUNTS_BY_DIFFICULTY[difficulty]) {
    try {
      return generateNanpureLegacyProblem({
        seed,
        clueCount,
        maximumAttempts: MAXIMUM_ATTEMPTS_PER_CLUE_COUNT,
        acceptCandidate: ({ difficultyAnalysis }) => {
          const assessment = assessNanpureLegacyDifficulty(difficultyAnalysis);
          return (
            assessment.status === "rated" &&
            assessment.difficulty === difficulty
          );
        },
      });
    } catch (error) {
      if (!(error instanceof NanpureLegacyGenerationExhaustedError)) {
        throw error;
      }
    }
  }

  throw new Error(`Failed to generate a ${difficulty} Nanpure problem`);
}
