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

const slidePuzzleDiagnosticFormat: InternalDiagnosticFormat<SlidePuzzleDiagnosticSnapshot> =
  {
    game: "slide-puzzle",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isSlidePuzzleProblemIdentity,
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

/** 評価の基準になる最短手数は問題集にしか無いので、問題集に無い識別情報では `null` を返す。 */
function restoreSlidePuzzleProblemFromDiagnosticSnapshot(
  snapshot: SlidePuzzleDiagnosticSnapshot,
): SlidePuzzleGeneratedProblem | null {
  return restoreSlidePuzzlePooledProblem(snapshot.problemIdentity);
}

export const _private = {
  parseSlidePuzzleDiagnosticSnapshot,
  restoreSlidePuzzleProblemFromDiagnosticSnapshot,
};
