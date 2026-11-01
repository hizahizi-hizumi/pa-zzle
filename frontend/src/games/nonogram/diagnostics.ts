import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { NonogramDifficulty } from "@/games/nonogram/difficulty";
import {
  isNonogramProblemIdentity,
  type NonogramProblemIdentity,
} from "@/games/nonogram/problem/problem";
import type { NonogramPooledProblem } from "@/games/nonogram/problem/problem-pool";
import { restoreNonogramProblem } from "@/games/nonogram/problem-selection";

export type NonogramDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "nonogram",
  NonogramDifficulty,
  NonogramProblemIdentity
>;

const nonogramDiagnosticFormat: InternalDiagnosticFormat<NonogramDiagnosticSnapshot> =
  {
    game: "nonogram",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isNonogramProblemIdentity,
  };

export function createNonogramDiagnosticSnapshot(input: {
  difficulty: NonogramDifficulty;
  problemIdentity: NonogramProblemIdentity;
  buildRevision: string | null;
}): NonogramDiagnosticSnapshot {
  return createInternalDiagnosticSnapshot(nonogramDiagnosticFormat, input);
}

function parseNonogramDiagnosticSnapshot(
  serialized: string,
): NonogramDiagnosticSnapshot {
  return parseInternalDiagnosticSnapshot(serialized, nonogramDiagnosticFormat);
}

/** 出題した難易度の問題集に無い identity は復元できないので `null` を返す。 */
function restoreNonogramProblemFromDiagnosticSnapshot(
  snapshot: NonogramDiagnosticSnapshot,
): NonogramPooledProblem | null {
  return restoreNonogramProblem(snapshot.difficulty, snapshot.problemIdentity);
}

export const _private = {
  parseNonogramDiagnosticSnapshot,
  restoreNonogramProblemFromDiagnosticSnapshot,
};
