import {
  createProblemRandom,
  shuffleProblemValues,
} from "@/games/problem-random";
import type { ProblemSeed } from "@/games/problem-seed";
import {
  assessParkingJamDifficulty,
  type ParkingJamDifficulty,
} from "./difficulty";
import {
  generateParkingJamProblem,
  ParkingJamGenerationExhaustedError,
} from "./problem/generator";
import type {
  ParkingJamGeneratedProblem,
  ParkingJamGenerationConditions,
} from "./problem/problem";

const MAXIMUM_ATTEMPTS_PER_GENERATION_PROFILE = 20;

type ParkingJamDifficultyGenerationProfile = ParkingJamGenerationConditions;

const DIFFICULTY_GENERATION_PROFILES: Record<
  ParkingJamDifficulty,
  readonly ParkingJamDifficultyGenerationProfile[]
> = {
  easy: [
    {
      width: 6,
      height: 6,
      vehicleCount: 8,
      roadOpeningCount: 4,
      roadOpeningSpan: 3,
      fixedAreaCount: 0,
      fixedAreaLength: 1,
      blockingPlacementProbability: 0,
    },
    {
      width: 6,
      height: 6,
      vehicleCount: 8,
      roadOpeningCount: 4,
      roadOpeningSpan: 3,
      fixedAreaCount: 1,
      fixedAreaLength: 2,
      blockingPlacementProbability: 0,
    },
  ],
  normal: [
    {
      width: 8,
      height: 8,
      vehicleCount: 12,
      roadOpeningCount: 4,
      roadOpeningSpan: 3,
      fixedAreaCount: 0,
      fixedAreaLength: 1,
      blockingPlacementProbability: 0.5,
    },
    {
      width: 8,
      height: 8,
      vehicleCount: 12,
      roadOpeningCount: 4,
      roadOpeningSpan: 3,
      fixedAreaCount: 1,
      fixedAreaLength: 2,
      blockingPlacementProbability: 0.5,
    },
  ],
  hard: [
    {
      width: 8,
      height: 8,
      vehicleCount: 14,
      roadOpeningCount: 4,
      roadOpeningSpan: 3,
      fixedAreaCount: 0,
      fixedAreaLength: 1,
      blockingPlacementProbability: 1,
    },
    {
      width: 8,
      height: 8,
      vehicleCount: 14,
      roadOpeningCount: 4,
      roadOpeningSpan: 3,
      fixedAreaCount: 1,
      fixedAreaLength: 2,
      blockingPlacementProbability: 1,
    },
  ],
};

function listGenerationProfiles(
  difficulty: ParkingJamDifficulty,
  seed: ProblemSeed,
): ParkingJamDifficultyGenerationProfile[] {
  return shuffleProblemValues(
    DIFFICULTY_GENERATION_PROFILES[difficulty],
    createProblemRandom(
      `parking-jam-difficulty-profile-v2:${difficulty}:${seed}`,
    ),
  );
}

export function generateParkingJamProblemForDifficulty(
  difficulty: ParkingJamDifficulty,
  seed: ProblemSeed,
): ParkingJamGeneratedProblem {
  for (const profile of listGenerationProfiles(difficulty, seed)) {
    try {
      return generateParkingJamProblem({
        seed,
        ...profile,
        maximumAttempts: MAXIMUM_ATTEMPTS_PER_GENERATION_PROFILE,
        acceptCandidate: ({ difficultyAnalysis }) => {
          const assessment = assessParkingJamDifficulty(difficultyAnalysis);
          return (
            assessment.status === "rated" &&
            assessment.difficulty === difficulty
          );
        },
      });
    } catch (error) {
      if (!(error instanceof ParkingJamGenerationExhaustedError)) throw error;
    }
  }

  throw new Error(`Failed to generate a ${difficulty} parking jam problem`);
}
