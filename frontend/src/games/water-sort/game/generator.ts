import type { Seed } from "@/games/core/seed";

import {
  solveWaterSort,
  type WaterSortSolveResult,
  type WaterSortSolverOptions,
} from "./solver";
import {
  WATER_SORT_BOTTLE_CAPACITY,
  WATER_SORT_EMPTY_BOTTLE_COUNT,
  createWaterSortStateKey,
  isCompleteWaterSortBottle,
  type WaterSortState,
} from "./state";

export const WATER_SORT_GENERATOR_VERSION = "1";

export type WaterSortGenerationConditions = {
  colorCount: number;
  capacity: typeof WATER_SORT_BOTTLE_CAPACITY;
  emptyBottleCount: typeof WATER_SORT_EMPTY_BOTTLE_COUNT;
};

export type WaterSortGeneratedCandidate = {
  attempt: number;
  initialState: WaterSortState;
  solveResult: WaterSortSolveResult;
};

export type WaterSortProblem = {
  generatorVersion: typeof WATER_SORT_GENERATOR_VERSION;
  seed: Seed;
  conditions: WaterSortGenerationConditions;
  generationAttempt: number;
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

function validateGeneratorOptions(options: WaterSortGeneratorOptions): void {
  if (!Number.isInteger(options.colorCount) || options.colorCount < 2) {
    throw new RangeError("colorCount must be an integer of two or greater");
  }

  const maximumAttempts = options.maximumAttempts ?? 100;
  if (!Number.isInteger(maximumAttempts) || maximumAttempts < 1) {
    throw new RangeError("maximumAttempts must be a positive integer");
  }
}

export function generateWaterSortProblem(
  options: WaterSortGeneratorOptions,
): WaterSortProblem {
  validateGeneratorOptions(options);

  const maximumAttempts = options.maximumAttempts ?? 100;
  const random = createSeededRandom(
    [
      WATER_SORT_GENERATOR_VERSION,
      options.seed,
      options.colorCount,
      WATER_SORT_BOTTLE_CAPACITY,
      WATER_SORT_EMPTY_BOTTLE_COUNT,
    ].join(":"),
  );
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

    return {
      generatorVersion: WATER_SORT_GENERATOR_VERSION,
      seed: options.seed,
      conditions: {
        colorCount: options.colorCount,
        capacity: WATER_SORT_BOTTLE_CAPACITY,
        emptyBottleCount: WATER_SORT_EMPTY_BOTTLE_COUNT,
      },
      generationAttempt: attempt,
      initialState,
      solutionMoves: solveResult.moves,
      searchStatistics: solveResult.statistics,
      features: solveResult.features,
    };
  }

  throw new Error(
    `Failed to generate a water sort problem within ${maximumAttempts} attempts`,
  );
}
