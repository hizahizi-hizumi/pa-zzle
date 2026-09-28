import {
  INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
  type InternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import {
  type NanpureLegacyDifficulty,
  parseNanpureLegacyDifficulty,
} from "@/games/nanpure/legacy/difficulty";
import {
  NANPURE_MINIMUM_UNIQUE_CLUE_COUNT,
  restoreNanpureLegacyProblem,
} from "@/games/nanpure/legacy/generator";
import {
  NANPURE_LEGACY_GENERATOR_VERSION,
  type NanpureLegacyGeneratedProblem,
  type NanpureLegacyProblemIdentity,
} from "@/games/nanpure/legacy/problem";
import { NANPURE_CELL_COUNT } from "@/games/nanpure/puzzle/board";

export type NanpureDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "nanpure",
  NanpureLegacyDifficulty,
  NanpureLegacyProblemIdentity
>;

export function createNanpureDiagnosticSnapshot({
  difficulty,
  problemIdentity,
  buildRevision,
}: {
  difficulty: NanpureLegacyDifficulty;
  problemIdentity: NanpureLegacyProblemIdentity;
  buildRevision: string | null;
}): NanpureDiagnosticSnapshot {
  return {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: "nanpure",
    difficulty,
    problemIdentity: {
      ...problemIdentity,
      conditions: { ...problemIdentity.conditions },
    },
    buildRevision,
  };
}

export function parseNanpureDiagnosticSnapshot(
  serialized: string,
): NanpureDiagnosticSnapshot {
  const value: unknown = JSON.parse(serialized);
  if (!isRecord(value)) {
    throw new TypeError("Nanpure diagnostic snapshot must be an object");
  }

  const difficulty =
    typeof value.difficulty === "string"
      ? parseNanpureLegacyDifficulty(value.difficulty)
      : undefined;
  if (
    value.formatVersion !== INTERNAL_DIAGNOSTIC_FORMAT_VERSION ||
    value.game !== "nanpure" ||
    !difficulty ||
    !isProblemIdentity(value.problemIdentity) ||
    !(typeof value.buildRevision === "string" || value.buildRevision === null)
  ) {
    throw new TypeError("Invalid Nanpure diagnostic snapshot");
  }

  return {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: "nanpure",
    difficulty,
    problemIdentity: value.problemIdentity,
    buildRevision: value.buildRevision,
  };
}

export function restoreNanpureProblemFromDiagnosticSnapshot(
  snapshot: NanpureDiagnosticSnapshot,
): NanpureLegacyGeneratedProblem {
  return restoreNanpureLegacyProblem(snapshot.problemIdentity);
}

function isProblemIdentity(
  value: unknown,
): value is NanpureLegacyProblemIdentity {
  if (!isRecord(value) || !isRecord(value.conditions)) {
    return false;
  }

  const clueCount = Number(value.conditions.clueCount);

  return (
    value.generatorVersion === NANPURE_LEGACY_GENERATOR_VERSION &&
    typeof value.seed === "string" &&
    Number.isInteger(value.conditions.clueCount) &&
    clueCount >= NANPURE_MINIMUM_UNIQUE_CLUE_COUNT &&
    clueCount <= NANPURE_CELL_COUNT &&
    Number.isInteger(value.generationAttempt) &&
    Number(value.generationAttempt) > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
