import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { SolitaireDifficulty } from "@/games/solitaire/difficulty";
import {
  isCurrentSolitaireProblemIdentity,
  restoreSolitaireProblem,
  type SolitaireIdentifiedProblem,
  type SolitaireProblemIdentity,
} from "@/games/solitaire/problem/problem";

export type SolitaireDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "solitaire",
  SolitaireDifficulty,
  SolitaireProblemIdentity
>;

const solitaireDiagnosticFormat: InternalDiagnosticFormat<SolitaireDiagnosticSnapshot> =
  {
    game: "solitaire",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isCurrentSolitaireProblemIdentity,
  };

/** 配った札は identity の seed から復号できるので、共通の項目だけを写す。 */
export function createSolitaireDiagnosticSnapshot(input: {
  difficulty: SolitaireDifficulty;
  problemIdentity: SolitaireProblemIdentity;
  buildRevision: string | null;
}): SolitaireDiagnosticSnapshot {
  return createInternalDiagnosticSnapshot(solitaireDiagnosticFormat, input);
}

function parseSolitaireDiagnosticSnapshot(
  serialized: string,
): SolitaireDiagnosticSnapshot {
  return parseInternalDiagnosticSnapshot(serialized, solitaireDiagnosticFormat);
}

function restoreSolitaireProblemFromDiagnosticSnapshot(
  snapshot: SolitaireDiagnosticSnapshot,
): SolitaireIdentifiedProblem {
  return restoreSolitaireProblem(snapshot.problemIdentity);
}

export const _private = {
  parseSolitaireDiagnosticSnapshot,
  restoreSolitaireProblemFromDiagnosticSnapshot,
};
