import {
  type InternalDiagnosticSnapshot,
  INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
} from "@/games/diagnostics";
import {
  type NanpureDifficulty,
  parseNanpureDifficulty,
} from "@/games/nanpure/difficulty";
import {
  NANPURE_MINIMUM_UNIQUE_CLUE_COUNT,
  restoreNanpureProblem,
} from "@/games/nanpure/problem/generator";
import {
  NANPURE_GENERATOR_VERSION,
  type NanpureGeneratedProblem,
  type NanpureProblemIdentity,
} from "@/games/nanpure/problem/problem";
import { NANPURE_CELL_COUNT } from "@/games/nanpure/puzzle/board";

export type NanpureDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "nanpure",
  NanpureDifficulty,
  NanpureProblemIdentity
>;

export function createNanpureDiagnosticSnapshot({
  difficulty,
  problemIdentity,
  buildRevision,
}: {
  difficulty: NanpureDifficulty;
  problemIdentity: NanpureProblemIdentity;
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
      ? parseNanpureDifficulty(value.difficulty)
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
): NanpureGeneratedProblem {
  return restoreNanpureProblem(snapshot.problemIdentity);
}

function isProblemIdentity(value: unknown): value is NanpureProblemIdentity {
  if (!isRecord(value) || !isRecord(value.conditions)) {
    return false;
  }

  const clueCount = Number(value.conditions.clueCount);

  return (
    value.generatorVersion === NANPURE_GENERATOR_VERSION &&
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
