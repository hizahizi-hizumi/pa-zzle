import type { Seed } from "@/games/core/seed";

import {
  rateUniqueSudokuDifficulty,
  type SudokuDifficultyRating,
} from "./difficulty-rating";
import { classifySudokuSolutions, findSudokuSolution } from "./solver";
import {
  SUDOKU_CELL_COUNT,
  type SudokuBoard,
  type SudokuProblem,
  type SudokuSolution,
} from "./state";

export const SUDOKU_GENERATOR_VERSION = "1";
export const SUDOKU_MINIMUM_UNIQUE_CLUE_COUNT = 17;

export type SudokuGenerationConditions = {
  clueCount: number;
};

export type SudokuProblemIdentity = {
  generatorVersion: typeof SUDOKU_GENERATOR_VERSION;
  seed: Seed;
  conditions: SudokuGenerationConditions;
  generationAttempt: number;
};

export type SudokuGeneratedCandidate = SudokuProblem & {
  attempt: number;
  difficultyRating: SudokuDifficultyRating;
};

export type SudokuProblemAcceptance = (
  candidate: SudokuGeneratedCandidate,
) => boolean;

export type GeneratedSudokuProblem = SudokuProblem & {
  identity: SudokuProblemIdentity;
  difficultyRating: SudokuDifficultyRating;
};

export type SudokuGeneratorOptions = {
  seed: Seed;
  clueCount: number;
  maximumAttempts?: number;
  acceptCandidate?: SudokuProblemAcceptance;
};

export class SudokuGenerationExhaustedError extends Error {
  constructor(maximumAttempts: number, clueCount: number) {
    super(
      `Failed to generate a ${clueCount}-clue Sudoku problem within ${maximumAttempts} attempts`,
    );
    this.name = "SudokuGenerationExhaustedError";
  }
}

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

function createGeneratorRandom(seed: Seed, clueCount: number): () => number {
  return createSeededRandom(
    [SUDOKU_GENERATOR_VERSION, seed, clueCount].join(":"),
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
    clueCount < SUDOKU_MINIMUM_UNIQUE_CLUE_COUNT ||
    clueCount > SUDOKU_CELL_COUNT
  ) {
    throw new RangeError(
      `clueCount must be an integer between ${SUDOKU_MINIMUM_UNIQUE_CLUE_COUNT} and ${SUDOKU_CELL_COUNT}`,
    );
  }
}

function validateMaximumAttempts(maximumAttempts: number): void {
  if (!Number.isInteger(maximumAttempts) || maximumAttempts < 1) {
    throw new RangeError("maximumAttempts must be a positive integer");
  }
}

function validateProblemIdentity(identity: SudokuProblemIdentity): void {
  if (identity.generatorVersion !== SUDOKU_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported Sudoku generator version: ${identity.generatorVersion}`,
    );
  }

  validateClueCount(identity.conditions.clueCount);
  validateMaximumAttempts(identity.generationAttempt);
}

function createEmptyBoard(): SudokuBoard {
  return Array.from({ length: SUDOKU_CELL_COUNT }, () => null);
}

function createPuzzleCandidate(
  clueCount: number,
  random: () => number,
): SudokuProblem | null {
  const solution = findSudokuSolution(createEmptyBoard(), { random });
  if (!solution) {
    return null;
  }

  const clues = [...solution] as Array<SudokuSolution[number] | null>;
  const removalOrder = shuffle(
    Array.from({ length: SUDOKU_CELL_COUNT }, (_, index) => index),
    random,
  );
  let remainingClues = SUDOKU_CELL_COUNT;

  for (const cellIndex of removalOrder) {
    if (remainingClues <= clueCount) {
      break;
    }

    const digit = clues[cellIndex];
    if (digit === null || digit === undefined) {
      continue;
    }

    clues[cellIndex] = null;
    const classification = classifySudokuSolutions(clues);
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
  identity: SudokuProblemIdentity,
): SudokuProblem | null {
  const random = createGeneratorRandom(
    identity.seed,
    identity.conditions.clueCount,
  );
  let candidate: SudokuProblem | null = null;

  for (let attempt = 1; attempt <= identity.generationAttempt; attempt += 1) {
    candidate = createPuzzleCandidate(identity.conditions.clueCount, random);
  }

  return candidate;
}

export function restoreSudokuProblem(
  identity: SudokuProblemIdentity,
): GeneratedSudokuProblem {
  validateProblemIdentity(identity);

  const problem = candidateAtAttempt(identity);
  if (!problem) {
    throw new Error(
      "Sudoku problem identity does not reference a valid problem",
    );
  }

  return {
    ...problem,
    identity,
    difficultyRating: rateUniqueSudokuDifficulty(problem.clues),
  };
}

export function generateSudokuProblem(
  options: SudokuGeneratorOptions,
): GeneratedSudokuProblem {
  validateClueCount(options.clueCount);

  const maximumAttempts = options.maximumAttempts ?? 100;
  validateMaximumAttempts(maximumAttempts);

  const random = createGeneratorRandom(options.seed, options.clueCount);

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const problem = createPuzzleCandidate(options.clueCount, random);
    if (!problem) {
      continue;
    }

    const difficultyRating = rateUniqueSudokuDifficulty(problem.clues);
    const candidate: SudokuGeneratedCandidate = {
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
        generatorVersion: SUDOKU_GENERATOR_VERSION,
        seed: options.seed,
        conditions: { clueCount: options.clueCount },
        generationAttempt: attempt,
      },
      difficultyRating,
    };
  }

  throw new SudokuGenerationExhaustedError(maximumAttempts, options.clueCount);
}
