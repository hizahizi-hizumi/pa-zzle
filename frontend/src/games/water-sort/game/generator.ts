import type { Seed } from "@/games/core/seed";

import {
  solveWaterSort,
  type WaterSortSolveResult,
  type WaterSortSolverOptions,
} from "./solver";
import {
  createWaterSortStateKey,
  isCompleteWaterSortBottle,
  WATER_SORT_BOTTLE_CAPACITY,
  WATER_SORT_EMPTY_BOTTLE_COUNT,
  type WaterSortState,
} from "./state";

export const WATER_SORT_GENERATOR_VERSION = "1";

export type WaterSortGenerationConditions = {
  colorCount: number;
  capacity: typeof WATER_SORT_BOTTLE_CAPACITY;
  emptyBottleCount: typeof WATER_SORT_EMPTY_BOTTLE_COUNT;
};

export type WaterSortProblemIdentity = {
  generatorVersion: typeof WATER_SORT_GENERATOR_VERSION;
  seed: Seed;
  conditions: WaterSortGenerationConditions;
  generationAttempt: number;
};

export type WaterSortGeneratedCandidate = {
  attempt: number;
  initialState: WaterSortState;
  solveResult: WaterSortSolveResult;
};

export type WaterSortProblem = WaterSortProblemIdentity & {
  initialState: WaterSortState;
  solutionMoves: WaterSortSolveResult["moves"];
  searchStatistics: WaterSortSolveResult["statistics"];
  features: NonNullable<WaterSortSolveResult["features"]>;
};

export type WaterSortProblemAcceptance = (
  candidate: WaterSortGeneratedCandidate,
) => boolean;

export type WaterSortGeneratorOptions = {
  seed: Seed;
  colorCount: number;
  maximumAttempts?: number;
  solverOptions?: WaterSortSolverOptions;
  acceptCandidate?: WaterSortProblemAcceptance;
};

function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

function createGeneratorRandom(seed: Seed, colorCount: number): () => number {
  return createSeededRandom(
    [
      WATER_SORT_GENERATOR_VERSION,
      seed,
      colorCount,
      WATER_SORT_BOTTLE_CAPACITY,
      WATER_SORT_EMPTY_BOTTLE_COUNT,
    ].join(":"),
  );
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const value = shuffled[index];
    const swapValue = shuffled[swapIndex];
    if (value === undefined || swapValue === undefined) {
      continue;
    }
    shuffled[index] = swapValue;
    shuffled[swapIndex] = value;
  }

  return shuffled;
}

function createStandardCandidate(
  colorCount: number,
  random: () => number,
): WaterSortState {
  const units = Array.from(
    { length: colorCount * WATER_SORT_BOTTLE_CAPACITY },
    (_, index) => Math.floor(index / WATER_SORT_BOTTLE_CAPACITY),
  );
  const shuffledUnits = shuffle(units, random);
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
  features: NonNullable<WaterSortSolveResult["features"]>,
): WaterSortProblem {
  return {
    ...identity,
    initialState,
    solutionMoves: solveResult.moves,
    searchStatistics: solveResult.statistics,
    features,
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

export function recreateWaterSortProblem(
  identity: WaterSortProblemIdentity,
): WaterSortProblem {
  validateProblemIdentity(identity);

  const initialState = findCandidateAtAttempt(identity);
  const solveResult = solveWaterSort(initialState);
  if (solveResult.status !== "solved" || !solveResult.features) {
    throw new Error(
      "Water sort problem identity references an unsolved candidate",
    );
  }

  return createProblem(
    identity,
    initialState,
    solveResult,
    solveResult.features,
  );
}

export function generateWaterSortProblem(
  options: WaterSortGeneratorOptions,
): WaterSortProblem {
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
    if (solveResult.status !== "solved" || !solveResult.features) {
      continue;
    }

    const candidate = { attempt, initialState, solveResult };
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
      solveResult.features,
    );
  }

  throw new Error(
    `Failed to generate a water sort problem within ${maximumAttempts} attempts`,
  );
}
