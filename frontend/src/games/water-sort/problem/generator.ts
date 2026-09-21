import {
  createProblemRandom,
  shuffleProblemValues,
} from "@/games/problem-random";
import type { ProblemSeed } from "@/games/problem-seed";
import {
  createWaterSortStateKey,
  isCompleteWaterSortBottle,
  WATER_SORT_BOTTLE_CAPACITY,
  WATER_SORT_EMPTY_BOTTLE_COUNT,
  type WaterSortState,
} from "../puzzle/state";
import {
  analyzeWaterSortDifficulty,
  type WaterSortDifficultyAnalysis,
} from "./difficulty-analysis";
import {
  solveWaterSort,
  type WaterSortSolveResult,
  type WaterSortSolverOptions,
} from "./generation/solver";
import {
  WATER_SORT_GENERATOR_VERSION,
  type WaterSortGeneratedProblem,
  type WaterSortGenerationConditions,
  type WaterSortProblemIdentity,
} from "./problem";

export type WaterSortGeneratedCandidate = {
  attempt: number;
  initialState: WaterSortState;
  difficultyAnalysis: WaterSortDifficultyAnalysis;
};

export type WaterSortProblemAcceptance = (
  candidate: WaterSortGeneratedCandidate,
) => boolean;

export class WaterSortGenerationExhaustedError extends Error {
  constructor(maximumAttempts: number) {
    super(
      `Failed to generate a water sort problem within ${maximumAttempts} attempts`,
    );
    this.name = "WaterSortGenerationExhaustedError";
  }
}

export type WaterSortGeneratorOptions = {
  seed: ProblemSeed;
  colorCount: number;
  maximumAttempts?: number;
  solverOptions?: WaterSortSolverOptions;
  acceptCandidate?: WaterSortProblemAcceptance;
};

function createGeneratorRandom(
  seed: ProblemSeed,
  colorCount: number,
): () => number {
  return createProblemRandom(
    [
      WATER_SORT_GENERATOR_VERSION,
      seed,
      colorCount,
      WATER_SORT_BOTTLE_CAPACITY,
      WATER_SORT_EMPTY_BOTTLE_COUNT,
    ].join(":"),
  );
}

function createStandardCandidate(
  colorCount: number,
  random: () => number,
): WaterSortState {
  const units = Array.from(
    { length: colorCount * WATER_SORT_BOTTLE_CAPACITY },
    (_, index) => Math.floor(index / WATER_SORT_BOTTLE_CAPACITY),
  );
  const shuffledUnits = shuffleProblemValues(units, random);
  const bottles = Array.from({ length: colorCount }, (_, bottleIndex) =>
    shuffledUnits.slice(
      bottleIndex * WATER_SORT_BOTTLE_CAPACITY,
      (bottleIndex + 1) * WATER_SORT_BOTTLE_CAPACITY,
    ),
  );

  return [
    ...bottles,
    ...Array.from({ length: WATER_SORT_EMPTY_BOTTLE_COUNT }, () => []),
  ];
}

function hasInitiallyCompletedBottle(state: WaterSortState): boolean {
  return state.some(isCompleteWaterSortBottle);
}

function validateColorCount(colorCount: number): void {
  if (!Number.isInteger(colorCount) || colorCount < 2) {
    throw new RangeError("colorCount must be an integer of two or greater");
  }
}

function validateGeneratorOptions(options: WaterSortGeneratorOptions): void {
  validateColorCount(options.colorCount);

  const maximumAttempts = options.maximumAttempts ?? 100;
  if (!Number.isInteger(maximumAttempts) || maximumAttempts < 1) {
    throw new RangeError("maximumAttempts must be a positive integer");
  }
}

function validateProblemIdentity(identity: WaterSortProblemIdentity): void {
  if (identity.generatorVersion !== WATER_SORT_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported water sort generator version: ${identity.generatorVersion}`,
    );
  }

  validateColorCount(identity.conditions.colorCount);
  if (
    identity.conditions.capacity !== WATER_SORT_BOTTLE_CAPACITY ||
    identity.conditions.emptyBottleCount !== WATER_SORT_EMPTY_BOTTLE_COUNT
  ) {
    throw new Error("Unsupported water sort generation conditions");
  }

  if (
    !Number.isInteger(identity.generationAttempt) ||
    identity.generationAttempt < 1
  ) {
    throw new RangeError("generationAttempt must be a positive integer");
  }
}

function createProblem(
  identity: WaterSortProblemIdentity,
  initialState: WaterSortState,
  solveResult: WaterSortSolveResult,
  difficultyAnalysis: WaterSortDifficultyAnalysis,
): WaterSortGeneratedProblem {
  return {
    problem: { initialState },
    identity,
    optimalMoveCount: solveResult.moves.length,
    difficultyAnalysis,
  };
}

function findCandidateAtAttempt(
  identity: WaterSortProblemIdentity,
): WaterSortState {
  const random = createGeneratorRandom(
    identity.seed,
    identity.conditions.colorCount,
  );
  const seenStates = new Set<string>();

  for (let attempt = 1; attempt <= identity.generationAttempt; attempt += 1) {
    const initialState = createStandardCandidate(
      identity.conditions.colorCount,
      random,
    );
    if (hasInitiallyCompletedBottle(initialState)) {
      if (attempt === identity.generationAttempt) {
        break;
      }
      continue;
    }

    const stateIdentity = createWaterSortStateKey(initialState);
    if (seenStates.has(stateIdentity)) {
      if (attempt === identity.generationAttempt) {
        break;
      }
      continue;
    }
    seenStates.add(stateIdentity);

    if (attempt === identity.generationAttempt) {
      return initialState;
    }
  }

  throw new Error("Water sort problem identity does not reference a candidate");
}

export function restoreWaterSortProblem(
  identity: WaterSortProblemIdentity,
): WaterSortGeneratedProblem {
  validateProblemIdentity(identity);

  const initialState = findCandidateAtAttempt(identity);
  const solveResult = solveWaterSort(initialState);
  if (solveResult.status !== "solved") {
    throw new Error(
      "Water sort problem identity references an unsolved candidate",
    );
  }

  const difficultyAnalysis = analyzeWaterSortDifficulty(
    initialState,
    solveResult.moves,
  );

  return createProblem(identity, initialState, solveResult, difficultyAnalysis);
}

export function generateWaterSortProblem(
  options: WaterSortGeneratorOptions,
): WaterSortGeneratedProblem {
  validateGeneratorOptions(options);

  const maximumAttempts = options.maximumAttempts ?? 100;
  const conditions: WaterSortGenerationConditions = {
    colorCount: options.colorCount,
    capacity: WATER_SORT_BOTTLE_CAPACITY,
    emptyBottleCount: WATER_SORT_EMPTY_BOTTLE_COUNT,
  };
  const random = createGeneratorRandom(options.seed, options.colorCount);
  const seenStates = new Set<string>();

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const initialState = createStandardCandidate(options.colorCount, random);
    if (hasInitiallyCompletedBottle(initialState)) {
      continue;
    }

    const stateIdentity = createWaterSortStateKey(initialState);
    if (seenStates.has(stateIdentity)) {
      continue;
    }
    seenStates.add(stateIdentity);

    const solveResult = solveWaterSort(initialState, options.solverOptions);
    if (solveResult.status !== "solved") {
      continue;
    }

    const difficultyAnalysis = analyzeWaterSortDifficulty(
      initialState,
      solveResult.moves,
    );
    const candidate = {
      attempt,
      initialState,
      difficultyAnalysis,
    };
    if (options.acceptCandidate && !options.acceptCandidate(candidate)) {
      continue;
    }

    return createProblem(
      {
        generatorVersion: WATER_SORT_GENERATOR_VERSION,
        seed: options.seed,
        conditions,
        generationAttempt: attempt,
      },
      initialState,
      solveResult,
      difficultyAnalysis,
    );
  }

  throw new WaterSortGenerationExhaustedError(maximumAttempts);
}
