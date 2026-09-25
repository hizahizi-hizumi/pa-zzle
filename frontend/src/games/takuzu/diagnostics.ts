import {
  INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
  type InternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import {
  parseTakuzuDifficulty,
  type TakuzuDifficulty,
} from "@/games/takuzu/difficulty";
import {
  isTakuzuProblemIdentity,
  type TakuzuIdentifiedProblem,
  type TakuzuProblemIdentity,
} from "@/games/takuzu/problem/problem";
import { restoreTakuzuProblem } from "@/games/takuzu/problem-selection";

export type TakuzuDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "takuzu",
  TakuzuDifficulty,
  TakuzuProblemIdentity
>;

export function createTakuzuDiagnosticSnapshot({
  difficulty,
  problemIdentity,
  buildRevision,
}: {
  difficulty: TakuzuDifficulty;
  problemIdentity: TakuzuProblemIdentity;
  buildRevision: string | null;
}): TakuzuDiagnosticSnapshot {
  return {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: "takuzu",
    difficulty,
    problemIdentity: {
      ...problemIdentity,
      conditions: { ...problemIdentity.conditions },
    },
    buildRevision,
  };
}

export function parseTakuzuDiagnosticSnapshot(
  serialized: string,
): TakuzuDiagnosticSnapshot {
  const value: unknown = JSON.parse(serialized);
  if (!isRecord(value)) {
    throw new TypeError("Takuzu diagnostic snapshot must be an object");
  }

  const difficulty =
    typeof value.difficulty === "string"
      ? parseTakuzuDifficulty(value.difficulty)
      : undefined;
  if (
    value.formatVersion !== INTERNAL_DIAGNOSTIC_FORMAT_VERSION ||
    value.game !== "takuzu" ||
    !difficulty ||
    !isTakuzuProblemIdentity(value.problemIdentity) ||
    !(typeof value.buildRevision === "string" || value.buildRevision === null)
  ) {
    throw new TypeError("Invalid Takuzu diagnostic snapshot");
  }

  return {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: "takuzu",
    difficulty,
    problemIdentity: value.problemIdentity,
    buildRevision: value.buildRevision,
  };
}

/** 問題集に無い identity は復元できないので `null` を返す。 */
export function restoreTakuzuProblemFromDiagnosticSnapshot(
  snapshot: TakuzuDiagnosticSnapshot,
): TakuzuIdentifiedProblem | null {
  return restoreTakuzuProblem(snapshot.problemIdentity);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
