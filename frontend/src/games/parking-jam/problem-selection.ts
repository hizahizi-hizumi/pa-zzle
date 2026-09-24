import {
  createProblemRandom,
  shuffleProblemValues,
} from "@/games/problem-random";
import type { ProblemSeed } from "@/games/problem-seed";
import {
  assessParkingJamReviewDifficulty,
  type ParkingJamDifficulty,
} from "./difficulty";
import { listParkingJamDifficultyCandidateConditions } from "./problem/generation/difficulty-candidate-space";
import {
  generateParkingJamProblem,
  ParkingJamGenerationExhaustedError,
} from "./problem/generator";
import type {
  ParkingJamGeneratedProblem,
  ParkingJamGenerationConditions,
} from "./problem/problem";

const MAXIMUM_REVIEW_SUPPLY_PROFILES = 72;
const MAXIMUM_ATTEMPTS_PER_REVIEW_SUPPLY_PROFILE = 2;

export const PARKING_JAM_REVIEW_SUPPLY_VERSION = "candidate-space-v1";

function hasReviewSupplyGenerationCapacity(
  conditions: ParkingJamGenerationConditions,
): boolean {
  const minimumOccupiedCellCount =
    conditions.vehicleCount * 2 +
    conditions.fixedAreaCount * conditions.fixedAreaLength;
  return (
    minimumOccupiedCellCount * 3 <= conditions.width * conditions.height * 2
  );
}

function listParkingJamReviewSupplyConditions(seed: ProblemSeed) {
  const random = createProblemRandom(
    `${PARKING_JAM_REVIEW_SUPPLY_VERSION}:${seed}`,
  );
  const supplyableConditions =
    listParkingJamDifficultyCandidateConditions().filter(
      hasReviewSupplyGenerationCapacity,
    );
  return shuffleProblemValues(supplyableConditions, random).slice(
    0,
    MAXIMUM_REVIEW_SUPPLY_PROFILES,
  );
}

export function generateParkingJamProblemForDifficulty(
  difficulty: ParkingJamDifficulty,
  seed: ProblemSeed,
): ParkingJamGeneratedProblem {
  for (const conditions of listParkingJamReviewSupplyConditions(seed)) {
    try {
      return generateParkingJamProblem({
        seed,
        ...conditions,
        maximumAttempts: MAXIMUM_ATTEMPTS_PER_REVIEW_SUPPLY_PROFILE,
        acceptCandidate: ({ difficultyAnalysis }) => {
          const assessment =
            assessParkingJamReviewDifficulty(difficultyAnalysis);
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

  throw new Error(
    `Failed to generate a ${difficulty} parking jam review problem`,
  );
}

export const _private = {
  listParkingJamReviewSupplyConditions,
};
