import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { MagicSquareDifficulty } from "@/games/magic-square/difficulty";
import {
  isCurrentMagicSquareProblemIdentity,
  type MagicSquareIdentifiedProblem,
  type MagicSquareProblemIdentity,
  restoreMagicSquareProblem,
} from "@/games/magic-square/problem/problem";

export type MagicSquareDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "magic-square",
  MagicSquareDifficulty,
  MagicSquareProblemIdentity
>;

const magicSquareDiagnosticFormat: InternalDiagnosticFormat<MagicSquareDiagnosticSnapshot> =
  {
    game: "magic-square",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isCurrentMagicSquareProblemIdentity,
  };

export function createMagicSquareDiagnosticSnapshot(input: {
  difficulty: MagicSquareDifficulty;
  problemIdentity: MagicSquareProblemIdentity;
  buildRevision: string | null;
}): MagicSquareDiagnosticSnapshot {
  return createInternalDiagnosticSnapshot(magicSquareDiagnosticFormat, input);
}

function parseMagicSquareDiagnosticSnapshot(
  serialized: string,
): MagicSquareDiagnosticSnapshot {
  return parseInternalDiagnosticSnapshot(
    serialized,
    magicSquareDiagnosticFormat,
  );
}

function restoreMagicSquareProblemFromDiagnosticSnapshot(
  snapshot: MagicSquareDiagnosticSnapshot,
): MagicSquareIdentifiedProblem {
  return restoreMagicSquareProblem(snapshot.problemIdentity);
}

export const _private = {
  parseMagicSquareDiagnosticSnapshot,
  restoreMagicSquareProblemFromDiagnosticSnapshot,
};
