import type { ProblemSeed } from "@/games/problem-seed";
import {
  assessParkingJamDifficulty,
  type ParkingJamDifficulty,
} from "./difficulty";
import {
  generateParkingJamProblem,
  ParkingJamGenerationExhaustedError,
} from "./problem/generator";
import type { ParkingJamGeneratedProblem } from "./problem/problem";

const MAXIMUM_ATTEMPTS_PER_GENERATION_PROFILE = 20;

type ParkingJamLegacyDifficultyGenerationProfile = {
  roadOpeningCount: number;
  roadOpeningSpan: number;
  fixedAreaCount: number;
  fixedAreaLength: number;
  blockingPlacementProbability: number;
};

const LEGACY_DIFFICULTY_GENERATION_PROFILES: Record<
  ParkingJamDifficulty,
  readonly ParkingJamLegacyDifficultyGenerationProfile[]
> = {
  easy: [
    {
      roadOpeningCount: 4,
      roadOpeningSpan: 4,
      fixedAreaCount: 0,
      fixedAreaLength: 1,
      blockingPlacementProbability: 0,
    },
    {
      roadOpeningCount: 4,
      roadOpeningSpan: 4,
      fixedAreaCount: 1,
      fixedAreaLength: 2,
      blockingPlacementProbability: 0,
    },
  ],
  normal: [
    {
      roadOpeningCount: 4,
      roadOpeningSpan: 3,
      fixedAreaCount: 0,
      fixedAreaLength: 1,
      blockingPlacementProbability: 0.5,
    },
    {
      roadOpeningCount: 4,
      roadOpeningSpan: 3,
      fixedAreaCount: 1,
      fixedAreaLength: 2,
      blockingPlacementProbability: 0.5,
    },
  ],
  hard: [
    {
      roadOpeningCount: 4,
      roadOpeningSpan: 3,
      fixedAreaCount: 0,
      fixedAreaLength: 1,
      blockingPlacementProbability: 1,
    },
    {
      roadOpeningCount: 4,
      roadOpeningSpan: 2,
      fixedAreaCount: 0,
      fixedAreaLength: 1,
      blockingPlacementProbability: 1,
    },
  ],
};

export function generateParkingJamProblemForDifficulty(
  difficulty: ParkingJamDifficulty,
  seed: ProblemSeed,
): ParkingJamGeneratedProblem {
  for (const profile of LEGACY_DIFFICULTY_GENERATION_PROFILES[difficulty]) {
    try {
      return generateParkingJamProblem({
        seed,
        width: 8,
        height: 8,
        vehicleCount: 14,
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
