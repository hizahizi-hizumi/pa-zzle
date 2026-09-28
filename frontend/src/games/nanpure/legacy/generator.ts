import {
  analyzeNanpureLegacyDifficulty,
  type NanpureLegacyDifficultyAnalysis,
} from "@/games/nanpure/legacy/difficulty-analysis";
import {
  NANPURE_LEGACY_GENERATOR_VERSION,
  type NanpureLegacyGeneratedProblem,
  type NanpureLegacyProblemIdentity,
} from "@/games/nanpure/legacy/problem";
import {
  classifyNanpureSolutions,
  findNanpureSolution,
} from "@/games/nanpure/problem/generation/solver";
import type { NanpureProblem } from "@/games/nanpure/problem/problem";
import {
  NANPURE_CELL_COUNT,
  type NanpureBoard,
  type NanpureSolution,
} from "@/games/nanpure/puzzle/board";
import {
  createProblemRandom,
  shuffleProblemValues,
} from "@/games/problem-random";
import type { ProblemSeed } from "@/games/problem-seed";

export const NANPURE_MINIMUM_UNIQUE_CLUE_COUNT = 17;

export type NanpureLegacyGeneratedCandidate = NanpureProblem & {
  attempt: number;
  difficultyAnalysis: NanpureLegacyDifficultyAnalysis;
};

export type NanpureLegacyProblemAcceptance = (
  candidate: NanpureLegacyGeneratedCandidate,
) => boolean;

export type NanpureLegacyGeneratorOptions = {
  seed: ProblemSeed;
  clueCount: number;
  maximumAttempts?: number;
  acceptCandidate?: NanpureLegacyProblemAcceptance;
};

export class NanpureLegacyGenerationExhaustedError extends Error {
  constructor(maximumAttempts: number, clueCount: number) {
    super(
      `Failed to generate a ${clueCount}-clue Nanpure problem within ${maximumAttempts} attempts`,
    );
    this.name = "NanpureLegacyGenerationExhaustedError";
  }
}

function createGeneratorRandom(
  seed: ProblemSeed,
  clueCount: number,
): () => number {
  return createProblemRandom(
    [NANPURE_LEGACY_GENERATOR_VERSION, seed, clueCount].join(":"),
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

function validateProblemIdentity(identity: NanpureLegacyProblemIdentity): void {
  if (identity.generatorVersion !== NANPURE_LEGACY_GENERATOR_VERSION) {
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
  identity: NanpureLegacyProblemIdentity,
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

export function restoreNanpureLegacyProblem(
  identity: NanpureLegacyProblemIdentity,
): NanpureLegacyGeneratedProblem {
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
    difficultyAnalysis: analyzeNanpureLegacyDifficulty(problem.clues),
  };
}

export function generateNanpureLegacyProblem(
  options: NanpureLegacyGeneratorOptions,
): NanpureLegacyGeneratedProblem {
  validateClueCount(options.clueCount);

  const maximumAttempts = options.maximumAttempts ?? 100;
  validateMaximumAttempts(maximumAttempts);

  const random = createGeneratorRandom(options.seed, options.clueCount);

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const problem = createProblemCandidate(options.clueCount, random);
    if (!problem) {
      continue;
    }

    const difficultyAnalysis = analyzeNanpureLegacyDifficulty(problem.clues);
    const candidate: NanpureLegacyGeneratedCandidate = {
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
        generatorVersion: NANPURE_LEGACY_GENERATOR_VERSION,
        seed: options.seed,
        conditions: { clueCount: options.clueCount },
        generationAttempt: attempt,
      },
      difficultyAnalysis,
    };
  }

  throw new NanpureLegacyGenerationExhaustedError(
    maximumAttempts,
    options.clueCount,
  );
}
