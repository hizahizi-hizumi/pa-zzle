import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import {
  isSlidePuzzleProblemIdentityOfDifficulty,
  type SlidePuzzleDifficulty,
} from "@/games/slide-puzzle/difficulty";
import {
  isCurrentSlidePuzzleProblemIdentity,
  type SlidePuzzleProblemIdentity,
} from "@/games/slide-puzzle/problem/problem";
import type { SlidePuzzlePooledProblem } from "@/games/slide-puzzle/problem/problem-pool";
import { restoreSlidePuzzlePooledProblem } from "@/games/slide-puzzle/problem-selection";

export type SlidePuzzleDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "slide-puzzle",
  SlidePuzzleDifficulty,
  SlidePuzzleProblemIdentity
>;

const slidePuzzleDiagnosticFormat: InternalDiagnosticFormat<SlidePuzzleDiagnosticSnapshot> =
  {
    game: "slide-puzzle",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isCurrentSlidePuzzleProblemIdentity,
    readDetails(_, { difficulty, problemIdentity }) {
      return isSlidePuzzleProblemIdentityOfDifficulty(
        problemIdentity,
        difficulty,
      )
        ? {}
        : undefined;
    },
  };

export function createSlidePuzzleDiagnosticSnapshot(input: {
  difficulty: SlidePuzzleDifficulty;
  problemIdentity: SlidePuzzleProblemIdentity;
  buildRevision: string | null;
}): SlidePuzzleDiagnosticSnapshot {
  return createInternalDiagnosticSnapshot(slidePuzzleDiagnosticFormat, input);
}

function parseSlidePuzzleDiagnosticSnapshot(
  serialized: string,
): SlidePuzzleDiagnosticSnapshot {
  return parseInternalDiagnosticSnapshot(
    serialized,
    slidePuzzleDiagnosticFormat,
  );
}

function restoreSlidePuzzleProblemFromDiagnosticSnapshot(
  snapshot: SlidePuzzleDiagnosticSnapshot,
): SlidePuzzlePooledProblem | null {
  return restoreSlidePuzzlePooledProblem(snapshot.problemIdentity);
}

export const _private = {
  parseSlidePuzzleDiagnosticSnapshot,
  restoreSlidePuzzleProblemFromDiagnosticSnapshot,
};
