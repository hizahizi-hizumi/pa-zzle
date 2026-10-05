import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
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

const nanpureDiagnosticFormat: InternalDiagnosticFormat<NanpureDiagnosticSnapshot> =
  {
    game: "nanpure",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isNanpureProblemIdentity,
  };

export function createNanpureDiagnosticSnapshot(input: {
  difficulty: NanpureDifficulty;
  problemIdentity: NanpureProblemIdentity;
  buildRevision: string | null;
}): NanpureDiagnosticSnapshot {
  return createInternalDiagnosticSnapshot(nanpureDiagnosticFormat, input);
}

function parseNanpureDiagnosticSnapshot(
  serialized: string,
): NanpureDiagnosticSnapshot {
  return parseInternalDiagnosticSnapshot(serialized, nanpureDiagnosticFormat);
}

/** 問題集に無い identity は復元できないので `null` を返す。 */
function restoreNanpureProblemFromDiagnosticSnapshot(
  snapshot: NanpureDiagnosticSnapshot,
): NanpureIdentifiedProblem | null {
  return restoreNanpureProblem(snapshot.problemIdentity);
}

export const _private = {
  parseNanpureDiagnosticSnapshot,
  restoreNanpureProblemFromDiagnosticSnapshot,
};
