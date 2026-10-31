import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
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

const takuzuDiagnosticFormat: InternalDiagnosticFormat<TakuzuDiagnosticSnapshot> =
  {
    game: "takuzu",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isTakuzuProblemIdentity,
  };

export function createTakuzuDiagnosticSnapshot(input: {
  difficulty: TakuzuDifficulty;
  problemIdentity: TakuzuProblemIdentity;
  buildRevision: string | null;
}): TakuzuDiagnosticSnapshot {
  return createInternalDiagnosticSnapshot(takuzuDiagnosticFormat, input);
}

function parseTakuzuDiagnosticSnapshot(
  serialized: string,
): TakuzuDiagnosticSnapshot {
  return parseInternalDiagnosticSnapshot(serialized, takuzuDiagnosticFormat);
}

/** 問題集に無い identity は復元できないので `null` を返す。 */
function restoreTakuzuProblemFromDiagnosticSnapshot(
  snapshot: TakuzuDiagnosticSnapshot,
): TakuzuIdentifiedProblem | null {
  return restoreTakuzuProblem(snapshot.problemIdentity);
}

export const _private = {
  parseTakuzuDiagnosticSnapshot,
  restoreTakuzuProblemFromDiagnosticSnapshot,
};
