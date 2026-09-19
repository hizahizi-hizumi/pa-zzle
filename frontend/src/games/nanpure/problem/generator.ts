import type { ProblemSeed } from "@/games/problem-seed";
import {
  NANPURE_CELL_COUNT,
  type NanpureBoard,
  type NanpureSolution,
} from "../puzzle/board";
import {
  type NanpureDifficultyRating,
  rateUniqueNanpureDifficulty,
} from "./difficulty-rating";
import {
  classifyNanpureSolutions,
  findNanpureSolution,
} from "./generation/solver";
import {
  NANPURE_GENERATOR_VERSION,
  type NanpureGeneratedProblem,
  type NanpureProblem,
  type NanpureProblemIdentity,
} from "./problem";

export const NANPURE_MINIMUM_UNIQUE_CLUE_COUNT = 17;

export type NanpureGeneratedCandidate = NanpureProblem & {
  attempt: number;
  difficultyRating: NanpureDifficultyRating;
};

export type NanpureProblemAcceptance = (
  candidate: NanpureGeneratedCandidate,
) => boolean;

export type NanpureGeneratorOptions = {
  seed: ProblemSeed;
  clueCount: number;
  maximumAttempts?: number;
  acceptCandidate?: NanpureProblemAcceptance;
};

export class NanpureGenerationExhaustedError extends Error {
  constructor(maximumAttempts: number, clueCount: number) {
    super(
      `Failed to generate a ${clueCount}-clue Nanpure problem within ${maximumAttempts} attempts`,
    );
    this.name = "NanpureGenerationExhaustedError";
  }
}

function hashProblemSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function createProblemSeededRandom(seed: string): () => number {
  let state = hashProblemSeed(seed);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

function createGeneratorRandom(
  seed: ProblemSeed,
  clueCount: number,
): () => number {
  return createProblemSeededRandom(
    [NANPURE_GENERATOR_VERSION, seed, clueCount].join(":"),
  );
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex]!,
      shuffled[index]!,
    ];
  }

  return shuffled;
}

function validateClueCount(clueCount: number): void {
  if (
    !Number.isInteger(clueCount) ||
    clueCount < NANPURE_MINIMUM_UNIQUE_CLUE_COUNT ||
    clueCount > NANPURE_CELL_COUNT
  ) {
    throw new RangeError(
      `clueCount must be an integer between ${NANPURE_MINIMUM_UNIQUE_CLUE_COUNT} and ${NANPURE_CELL_COUNT}`,
    );
  }
}

function validateMaximumAttempts(maximumAttempts: number): void {
  if (!Number.isInteger(maximumAttempts) || maximumAttempts < 1) {
    throw new RangeError("maximumAttempts must be a positive integer");
  }
}

function validateProblemIdentity(identity: NanpureProblemIdentity): void {
  if (identity.generatorVersion !== NANPURE_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported Nanpure generator version: ${identity.generatorVersion}`,
    );
  }

  validateClueCount(identity.conditions.clueCount);
  validateMaximumAttempts(identity.generationAttempt);
}

function createEmptyBoard(): NanpureBoard {
  return Array.from({ length: NANPURE_CELL_COUNT }, () => null);
}

function createProblemCandidate(
  clueCount: number,
  random: () => number,
): NanpureProblem | null {
  const solution = findNanpureSolution(createEmptyBoard(), { random });
  if (!solution) {
    return null;
  }

  const clues = [...solution] as Array<NanpureSolution[number] | null>;
  const removalOrder = shuffle(
    Array.from({ length: NANPURE_CELL_COUNT }, (_, index) => index),
    random,
  );
  let remainingClues = NANPURE_CELL_COUNT;

  for (const cellIndex of removalOrder) {
    if (remainingClues <= clueCount) {
      break;
    }

    const digit = clues[cellIndex];
    if (digit === null || digit === undefined) {
      continue;
    }

    clues[cellIndex] = null;
    const classification = classifyNanpureSolutions(clues);
    if (classification.status === "unique") {
      remainingClues -= 1;
    } else {
      clues[cellIndex] = digit;
    }
  }

  if (remainingClues !== clueCount) {
    return null;
  }

  return { clues, solution };
}

function candidateAtAttempt(
  identity: NanpureProblemIdentity,
): NanpureProblem | null {
  const random = createGeneratorRandom(
    identity.seed,
    identity.conditions.clueCount,
  );
  let candidate: NanpureProblem | null = null;

  for (let attempt = 1; attempt <= identity.generationAttempt; attempt += 1) {
    candidate = createProblemCandidate(identity.conditions.clueCount, random);
  }

  return candidate;
}

export function restoreNanpureProblem(
  identity: NanpureProblemIdentity,
): NanpureGeneratedProblem {
  validateProblemIdentity(identity);

  const problem = candidateAtAttempt(identity);
  if (!problem) {
    throw new Error(
      "Nanpure problem identity does not reference a valid problem",
    );
  }

  return {
    ...problem,
    identity,
    difficultyRating: rateUniqueNanpureDifficulty(problem.clues),
  };
}

export function generateNanpureProblem(
  options: NanpureGeneratorOptions,
): NanpureGeneratedProblem {
  validateClueCount(options.clueCount);

  const maximumAttempts = options.maximumAttempts ?? 100;
  validateMaximumAttempts(maximumAttempts);

  const random = createGeneratorRandom(options.seed, options.clueCount);

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const problem = createProblemCandidate(options.clueCount, random);
    if (!problem) {
      continue;
    }

    const difficultyRating = rateUniqueNanpureDifficulty(problem.clues);
    const candidate: NanpureGeneratedCandidate = {
      ...problem,
      attempt,
      difficultyRating,
    };
    if (options.acceptCandidate && !options.acceptCandidate(candidate)) {
      continue;
    }

    return {
      ...problem,
      identity: {
        generatorVersion: NANPURE_GENERATOR_VERSION,
        seed: options.seed,
        conditions: { clueCount: options.clueCount },
        generationAttempt: attempt,
      },
      difficultyRating,
    };
  }

  throw new NanpureGenerationExhaustedError(maximumAttempts, options.clueCount);
}
