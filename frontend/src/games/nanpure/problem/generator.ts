import {
  createProblemRandom,
  shuffleProblemValues,
} from "@/games/problem-random";
import type { ProblemSeed } from "@/games/problem-seed";
import {
  NANPURE_CELL_COUNT,
  type NanpureBoard,
  type NanpureSolution,
} from "../puzzle/board";
import {
  analyzeNanpureDifficulty,
  type NanpureDifficultyAnalysis,
} from "./difficulty-analysis";
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
  difficultyAnalysis: NanpureDifficultyAnalysis;
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

function createGeneratorRandom(
  seed: ProblemSeed,
  clueCount: number,
): () => number {
  return createProblemRandom(
    [NANPURE_GENERATOR_VERSION, seed, clueCount].join(":"),
  );
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
  const removalOrder = shuffleProblemValues(
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
    difficultyAnalysis: analyzeNanpureDifficulty(problem.clues),
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

    const difficultyAnalysis = analyzeNanpureDifficulty(problem.clues);
    const candidate: NanpureGeneratedCandidate = {
      ...problem,
      attempt,
      difficultyAnalysis,
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
      difficultyAnalysis,
    };
  }

  throw new NanpureGenerationExhaustedError(maximumAttempts, options.clueCount);
}
