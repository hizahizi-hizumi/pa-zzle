import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { FukumenzanDifficulty } from "@/games/fukumenzan/difficulty";
import {
  type FukumenzanProblemIdentity,
  isCurrentFukumenzanProblemIdentity,
} from "@/games/fukumenzan/problem/problem";
import type { FukumenzanPooledProblem } from "@/games/fukumenzan/problem/problem-pool";
import { restoreFukumenzanProblem } from "@/games/fukumenzan/problem-selection";

export type FukumenzanDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "fukumenzan",
  FukumenzanDifficulty,
  FukumenzanProblemIdentity
>;

const fukumenzanDiagnosticFormat: InternalDiagnosticFormat<FukumenzanDiagnosticSnapshot> =
  {
    game: "fukumenzan",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isCurrentFukumenzanProblemIdentity,
  };

export function createFukumenzanDiagnosticSnapshot(input: {
  difficulty: FukumenzanDifficulty;
  problemIdentity: FukumenzanProblemIdentity;
  buildRevision: string | null;
}): FukumenzanDiagnosticSnapshot {
  return createInternalDiagnosticSnapshot(fukumenzanDiagnosticFormat, input);
}

function parseFukumenzanDiagnosticSnapshot(
  serialized: string,
): FukumenzanDiagnosticSnapshot {
  return parseInternalDiagnosticSnapshot(
    serialized,
    fukumenzanDiagnosticFormat,
  );
}

function restoreFukumenzanProblemFromDiagnosticSnapshot(
  snapshot: FukumenzanDiagnosticSnapshot,
): FukumenzanPooledProblem | null {
  return restoreFukumenzanProblem(snapshot.problemIdentity);
}

export const _private = {
  parseFukumenzanDiagnosticSnapshot,
  restoreFukumenzanProblemFromDiagnosticSnapshot,
};
