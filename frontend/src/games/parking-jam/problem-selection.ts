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

const MAXIMUM_ATTEMPTS_PER_GENERATION_PROFILE = 12;

type ParkingJamGenerationProfile = {
  exitProbability: number;
  blockingPlacementProbability: number;
};

const PREFERRED_GENERATION_PROFILES_BY_DIFFICULTY: Record<
  ParkingJamDifficulty,
  readonly ParkingJamGenerationProfile[]
> = {
  easy: [
    { exitProbability: 0.8, blockingPlacementProbability: 0 },
    { exitProbability: 0.7, blockingPlacementProbability: 0 },
    { exitProbability: 0.9, blockingPlacementProbability: 0 },
  ],
  normal: [
    { exitProbability: 0.45, blockingPlacementProbability: 0 },
    { exitProbability: 0.55, blockingPlacementProbability: 0 },
    { exitProbability: 0.35, blockingPlacementProbability: 0 },
  ],
  hard: [
    { exitProbability: 0.45, blockingPlacementProbability: 1 },
    { exitProbability: 0.4, blockingPlacementProbability: 1 },
    { exitProbability: 0.5, blockingPlacementProbability: 1 },
    { exitProbability: 0.35, blockingPlacementProbability: 0.5 },
  ],
};

export function generateParkingJamProblemForDifficulty(
  difficulty: ParkingJamDifficulty,
  seed: ProblemSeed,
): ParkingJamGeneratedProblem {
  for (const profile of PREFERRED_GENERATION_PROFILES_BY_DIFFICULTY[
    difficulty
  ]) {
    try {
      return generateParkingJamProblem({
        seed,
        width: 8,
        height: 8,
        vehicleCount: 14,
        obstacleCount: 4,
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
