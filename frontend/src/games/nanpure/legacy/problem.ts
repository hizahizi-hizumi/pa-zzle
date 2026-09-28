import type { NanpureLegacyDifficultyAnalysis } from "@/games/nanpure/legacy/difficulty-analysis";
import type { NanpureProblem } from "@/games/nanpure/problem/problem";
import type { ProblemSeed } from "@/games/problem-seed";

export const NANPURE_LEGACY_GENERATOR_VERSION = "1";

export type NanpureLegacyGenerationConditions = {
  clueCount: number;
};

export type NanpureLegacyProblemIdentity = {
  generatorVersion: typeof NANPURE_LEGACY_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: NanpureLegacyGenerationConditions;
  generationAttempt: number;
};

export type NanpureLegacyGeneratedProblem = NanpureProblem & {
  identity: NanpureLegacyProblemIdentity;
  difficultyAnalysis: NanpureLegacyDifficultyAnalysis;
};
