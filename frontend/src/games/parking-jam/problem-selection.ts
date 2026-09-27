import {
  assessParkingJamDifficulty,
  type ParkingJamDifficulty,
} from "@/games/parking-jam/difficulty";
import { listParkingJamDifficultyCandidateConditions } from "@/games/parking-jam/problem/generation/difficulty-candidate-space";
import {
  generateParkingJamProblem,
  ParkingJamGenerationExhaustedError,
} from "@/games/parking-jam/problem/generator";
import type {
  ParkingJamGeneratedProblem,
  ParkingJamGenerationConditions,
} from "@/games/parking-jam/problem/problem";
import {
  createProblemRandom,
  shuffleProblemValues,
} from "@/games/problem-random";
import type { ProblemSeed } from "@/games/problem-seed";

const MAXIMUM_SUPPLY_PROFILES = 72;
const MAXIMUM_ATTEMPTS_PER_SUPPLY_PROFILE = 2;

export const PARKING_JAM_SUPPLY_VERSION = "candidate-space-v1";

function hasSupplyGenerationCapacity(
  conditions: ParkingJamGenerationConditions,
): boolean {
  const minimumOccupiedCellCount =
    conditions.vehicleCount * 2 +
    conditions.fixedAreaCount * conditions.fixedAreaLength;
  return (
    minimumOccupiedCellCount * 3 <= conditions.width * conditions.height * 2
  );
}

function listParkingJamSupplyConditions(seed: ProblemSeed) {
  const random = createProblemRandom(`${PARKING_JAM_SUPPLY_VERSION}:${seed}`);
  const supplyableConditions =
    listParkingJamDifficultyCandidateConditions().filter(
      hasSupplyGenerationCapacity,
    );
  return shuffleProblemValues(supplyableConditions, random).slice(
    0,
    MAXIMUM_SUPPLY_PROFILES,
  );
}

export function generateParkingJamProblemForDifficulty(
  difficulty: ParkingJamDifficulty,
  seed: ProblemSeed,
): ParkingJamGeneratedProblem {
  for (const conditions of listParkingJamSupplyConditions(seed)) {
    try {
      return generateParkingJamProblem({
        seed,
        ...conditions,
        maximumAttempts: MAXIMUM_ATTEMPTS_PER_SUPPLY_PROFILE,
        acceptCandidate: ({ difficultyAnalysis }) => {
          const assessment = assessParkingJamDifficulty(difficultyAnalysis);
          return assessment.difficulty === difficulty;
        },
      });
    } catch (error) {
      if (!(error instanceof ParkingJamGenerationExhaustedError)) throw error;
    }
  }

  throw new Error(`Failed to generate a ${difficulty} parking jam problem`);
}

export const _private = {
  listParkingJamSupplyConditions,
};
