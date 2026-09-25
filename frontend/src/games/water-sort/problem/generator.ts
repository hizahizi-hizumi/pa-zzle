import {
  createProblemSeededRandom,
  type ProblemSeed,
} from "@/games/problem-seed";
import {
  solveWaterSort,
  type WaterSortSolverOptions,
} from "@/games/water-sort/problem/generation/solver";
import {
  WATER_SORT_GENERATOR_VERSION,
  type WaterSortGeneratedProblem,
  type WaterSortGenerationConditions,
  type WaterSortProblemIdentity,
} from "@/games/water-sort/problem/problem";
import {
  createWaterSortStateKey,
  isCompleteWaterSortBottle,
  WATER_SORT_BOTTLE_CAPACITY,
  WATER_SORT_EMPTY_BOTTLE_COUNT,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";

export type WaterSortGeneratedCandidate = {
  attempt: number;
  initialState: WaterSortState;
  optimalMoveCount: number;
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
  emptyBottleCount?: number;
  maximumAttempts?: number;
  solverOptions?: WaterSortSolverOptions;
  acceptCandidate?: WaterSortProblemAcceptance;
};

function createGeneratorRandom(
  seed: ProblemSeed,
  colorCount: number,
  emptyBottleCount: number,
): () => number {
  return createProblemSeededRandom(
    [
      WATER_SORT_GENERATOR_VERSION,
      seed,
      colorCount,
      WATER_SORT_BOTTLE_CAPACITY,
      emptyBottleCount,
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
  emptyBottleCount: number,
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

  return [...bottles, ...Array.from({ length: emptyBottleCount }, () => [])];
}

function hasInitiallyCompletedBottle(state: WaterSortState): boolean {
  return state.some(isCompleteWaterSortBottle);
}

function validateColorCount(colorCount: number): void {
  if (!Number.isInteger(colorCount) || colorCount < 2) {
    throw new RangeError("colorCount must be an integer of two or greater");
  }
}

function validateEmptyBottleCount(emptyBottleCount: number): void {
  if (!Number.isInteger(emptyBottleCount) || emptyBottleCount < 1) {
    throw new RangeError("emptyBottleCount must be a positive integer");
  }
}

function validateGeneratorOptions(options: WaterSortGeneratorOptions): void {
  validateColorCount(options.colorCount);
  validateEmptyBottleCount(
    options.emptyBottleCount ?? WATER_SORT_EMPTY_BOTTLE_COUNT,
  );

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
  validateEmptyBottleCount(identity.conditions.emptyBottleCount);
  if (identity.conditions.capacity !== WATER_SORT_BOTTLE_CAPACITY) {
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
  optimalMoveCount: number,
): WaterSortGeneratedProblem {
  return {
    problem: { initialState },
    identity,
    optimalMoveCount,
  };
}

function findCandidateAtAttempt(
  identity: WaterSortProblemIdentity,
): WaterSortState {
  const random = createGeneratorRandom(
    identity.seed,
    identity.conditions.colorCount,
    identity.conditions.emptyBottleCount,
  );
  const seenStates = new Set<string>();

  for (let attempt = 1; attempt <= identity.generationAttempt; attempt += 1) {
    const initialState = createStandardCandidate(
      identity.conditions.colorCount,
      identity.conditions.emptyBottleCount,
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

  return createProblem(identity, initialState, solveResult.moves.length);
}

export function restoreWaterSortProblemWithOptimalMoveCount(
  identity: WaterSortProblemIdentity,
  optimalMoveCount: number,
): WaterSortGeneratedProblem {
  validateProblemIdentity(identity);
  if (!Number.isInteger(optimalMoveCount) || optimalMoveCount < 1) {
    throw new RangeError("optimalMoveCount must be a positive integer");
  }

  return createProblem(
    identity,
    findCandidateAtAttempt(identity),
    optimalMoveCount,
  );
}

export function generateWaterSortProblem(
  options: WaterSortGeneratorOptions,
): WaterSortGeneratedProblem {
  validateGeneratorOptions(options);

  const maximumAttempts = options.maximumAttempts ?? 100;
  const emptyBottleCount =
    options.emptyBottleCount ?? WATER_SORT_EMPTY_BOTTLE_COUNT;
  const conditions: WaterSortGenerationConditions = {
    colorCount: options.colorCount,
    capacity: WATER_SORT_BOTTLE_CAPACITY,
    emptyBottleCount,
  };
  const random = createGeneratorRandom(
    options.seed,
    options.colorCount,
    emptyBottleCount,
  );
  const seenStates = new Set<string>();

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const initialState = createStandardCandidate(
      options.colorCount,
      emptyBottleCount,
      random,
    );
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

    const optimalMoveCount = solveResult.moves.length;
    if (
      options.acceptCandidate &&
      !options.acceptCandidate({ attempt, initialState, optimalMoveCount })
    ) {
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
      optimalMoveCount,
    );
  }

  throw new WaterSortGenerationExhaustedError(maximumAttempts);
}
