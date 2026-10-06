import {
  INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
  type InternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import {
  isNanpureProblemIdentity,
  type NanpureIdentifiedProblem,
  type NanpureProblemIdentity,
} from "@/games/nanpure/problem/problem";
import { restoreNanpureProblem } from "@/games/nanpure/problem-selection";

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
      ? parseDifficultyLevel(value.difficulty)
      : undefined;
  if (
    value.formatVersion !== INTERNAL_DIAGNOSTIC_FORMAT_VERSION ||
    value.game !== "nanpure" ||
    !difficulty ||
    !isNanpureProblemIdentity(value.problemIdentity) ||
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

/** 問題集に無い identity は復元できないので `null` を返す。 */
export function restoreNanpureProblemFromDiagnosticSnapshot(
  snapshot: NanpureDiagnosticSnapshot,
): NanpureIdentifiedProblem | null {
  return restoreNanpureProblem(snapshot.problemIdentity);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
