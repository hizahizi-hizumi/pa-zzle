import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import {
  type HakoiriMusumeIdentifiedProblem,
  type HakoiriMusumeProblemIdentity,
  isHakoiriMusumeProblemIdentity,
  restoreHakoiriMusumeProblem,
} from "@/games/hakoiri-musume/problem/problem";

export type HakoiriMusumeDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "hakoiri-musume",
  HakoiriMusumeDifficulty,
  HakoiriMusumeProblemIdentity
>;

const hakoiriMusumeDiagnosticFormat: InternalDiagnosticFormat<HakoiriMusumeDiagnosticSnapshot> =
  {
    game: "hakoiri-musume",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isHakoiriMusumeProblemIdentity,
    readDetails() {
      return {};
    },
  };

/** 遊んでいる問題の snapshot を作る。盤面は identity の `seed` そのもので、診断を開いたときに解き直さない。 */
export function createHakoiriMusumeDiagnosticSnapshot(input: {
  difficulty: HakoiriMusumeDifficulty;
  problemIdentity: HakoiriMusumeProblemIdentity;
  buildRevision: string | null;
}): HakoiriMusumeDiagnosticSnapshot {
  return createInternalDiagnosticSnapshot(hakoiriMusumeDiagnosticFormat, input);
}

function parseHakoiriMusumeDiagnosticSnapshot(
  serialized: string,
): HakoiriMusumeDiagnosticSnapshot {
  return parseInternalDiagnosticSnapshot(
    serialized,
    hakoiriMusumeDiagnosticFormat,
  );
}

function restoreHakoiriMusumeProblemFromDiagnosticSnapshot(
  snapshot: HakoiriMusumeDiagnosticSnapshot,
): HakoiriMusumeIdentifiedProblem {
  return restoreHakoiriMusumeProblem(snapshot.problemIdentity);
}

export const _private = {
  parseHakoiriMusumeDiagnosticSnapshot,
  restoreHakoiriMusumeProblemFromDiagnosticSnapshot,
};
