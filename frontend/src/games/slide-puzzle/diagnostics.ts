import {
  INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
  type InternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import {
  isSlidePuzzleProblemIdentityOfDifficulty,
  parseSlidePuzzleDifficulty,
  type SlidePuzzleDifficulty,
} from "@/games/slide-puzzle/difficulty";
import {
  isSlidePuzzleProblemIdentity,
  type SlidePuzzleGeneratedProblem,
  type SlidePuzzleProblemIdentity,
} from "@/games/slide-puzzle/problem/problem";
import { restoreSlidePuzzlePooledProblem } from "@/games/slide-puzzle/problem-selection";

export type SlidePuzzleDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "slide-puzzle",
  SlidePuzzleDifficulty,
  SlidePuzzleProblemIdentity
>;

export function createSlidePuzzleDiagnosticSnapshot({
  difficulty,
  problemIdentity,
  buildRevision,
}: {
  difficulty: SlidePuzzleDifficulty;
  problemIdentity: SlidePuzzleProblemIdentity;
  buildRevision: string | null;
}): SlidePuzzleDiagnosticSnapshot {
  return {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: "slide-puzzle",
    difficulty,
    problemIdentity: {
      ...problemIdentity,
      conditions: { ...problemIdentity.conditions },
    },
    buildRevision,
  };
}

function parseSlidePuzzleDiagnosticSnapshot(
  serialized: string,
): SlidePuzzleDiagnosticSnapshot {
  const value: unknown = JSON.parse(serialized);
  if (!isRecord(value)) {
    throw new TypeError("Slide puzzle diagnostic snapshot must be an object");
  }

  const difficulty =
    typeof value.difficulty === "string"
      ? parseSlidePuzzleDifficulty(value.difficulty)
      : undefined;
  if (
    value.formatVersion !== INTERNAL_DIAGNOSTIC_FORMAT_VERSION ||
    value.game !== "slide-puzzle" ||
    !difficulty ||
    !isSlidePuzzleProblemIdentity(value.problemIdentity) ||
    !isSlidePuzzleProblemIdentityOfDifficulty(
      value.problemIdentity,
      difficulty,
    ) ||
    !(typeof value.buildRevision === "string" || value.buildRevision === null)
  ) {
    throw new TypeError("Invalid slide puzzle diagnostic snapshot");
  }

  return {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: "slide-puzzle",
    difficulty,
    problemIdentity: value.problemIdentity,
    buildRevision: value.buildRevision,
  };
}

/** 評価の基準になる最短手数は問題集にしか無いので、問題集に無い識別情報では `null` を返す。 */
function restoreSlidePuzzleProblemFromDiagnosticSnapshot(
  snapshot: SlidePuzzleDiagnosticSnapshot,
): SlidePuzzleGeneratedProblem | null {
  return restoreSlidePuzzlePooledProblem(snapshot.problemIdentity);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const _private = {
  parseSlidePuzzleDiagnosticSnapshot,
  restoreSlidePuzzleProblemFromDiagnosticSnapshot,
};
