import {
  INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
  type InternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import {
  type FifteenPuzzleDifficulty,
  parseFifteenPuzzleDifficulty,
} from "@/games/fifteen-puzzle/difficulty";
import {
  type FifteenPuzzleGeneratedProblem,
  type FifteenPuzzleProblemIdentity,
  isFifteenPuzzleProblemIdentity,
} from "@/games/fifteen-puzzle/problem/problem";
import { restoreFifteenPuzzlePooledProblem } from "@/games/fifteen-puzzle/problem-selection";

export type FifteenPuzzleDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "fifteen-puzzle",
  FifteenPuzzleDifficulty,
  FifteenPuzzleProblemIdentity
>;

export function createFifteenPuzzleDiagnosticSnapshot({
  difficulty,
  problemIdentity,
  buildRevision,
}: {
  difficulty: FifteenPuzzleDifficulty;
  problemIdentity: FifteenPuzzleProblemIdentity;
  buildRevision: string | null;
}): FifteenPuzzleDiagnosticSnapshot {
  return {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: "fifteen-puzzle",
    difficulty,
    problemIdentity: {
      ...problemIdentity,
      conditions: { ...problemIdentity.conditions },
    },
    buildRevision,
  };
}

export function parseFifteenPuzzleDiagnosticSnapshot(
  serialized: string,
): FifteenPuzzleDiagnosticSnapshot {
  const value: unknown = JSON.parse(serialized);
  if (!isRecord(value)) {
    throw new TypeError("Fifteen puzzle diagnostic snapshot must be an object");
  }

  const difficulty =
    typeof value.difficulty === "string"
      ? parseFifteenPuzzleDifficulty(value.difficulty)
      : undefined;
  if (
    value.formatVersion !== INTERNAL_DIAGNOSTIC_FORMAT_VERSION ||
    value.game !== "fifteen-puzzle" ||
    !difficulty ||
    !isFifteenPuzzleProblemIdentity(value.problemIdentity) ||
    !(typeof value.buildRevision === "string" || value.buildRevision === null)
  ) {
    throw new TypeError("Invalid fifteen puzzle diagnostic snapshot");
  }

  return {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: "fifteen-puzzle",
    difficulty,
    problemIdentity: value.problemIdentity,
    buildRevision: value.buildRevision,
  };
}

/** 評価の基準になる最短手数は問題集にしか無いので、問題集に無い識別情報では `null` を返す。 */
export function restoreFifteenPuzzleProblemFromDiagnosticSnapshot(
  snapshot: FifteenPuzzleDiagnosticSnapshot,
): FifteenPuzzleGeneratedProblem | null {
  return restoreFifteenPuzzlePooledProblem(snapshot.problemIdentity);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
