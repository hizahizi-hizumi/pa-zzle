import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { ShuttleParkingDifficulty } from "@/games/shuttle-parking/difficulty";
import {
  isCurrentShuttleParkingProblemIdentity,
  restoreShuttleParkingProblem,
  type ShuttleParkingIdentifiedProblem,
  type ShuttleParkingProblemIdentity,
} from "@/games/shuttle-parking/problem/problem";

export type ShuttleParkingDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "shuttle-parking",
  ShuttleParkingDifficulty,
  ShuttleParkingProblemIdentity
>;

const shuttleParkingDiagnosticFormat: InternalDiagnosticFormat<ShuttleParkingDiagnosticSnapshot> =
  {
    game: "shuttle-parking",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isCurrentShuttleParkingProblemIdentity,
  };

export function createShuttleParkingDiagnosticSnapshot(input: {
  difficulty: ShuttleParkingDifficulty;
  problemIdentity: ShuttleParkingProblemIdentity;
  buildRevision: string | null;
}): ShuttleParkingDiagnosticSnapshot {
  return createInternalDiagnosticSnapshot(
    shuttleParkingDiagnosticFormat,
    input,
  );
}

function parseShuttleParkingDiagnosticSnapshot(
  serialized: string,
): ShuttleParkingDiagnosticSnapshot {
  return parseInternalDiagnosticSnapshot(
    serialized,
    shuttleParkingDiagnosticFormat,
  );
}

function restoreShuttleParkingProblemFromDiagnosticSnapshot(
  snapshot: ShuttleParkingDiagnosticSnapshot,
): ShuttleParkingIdentifiedProblem {
  return restoreShuttleParkingProblem(snapshot.problemIdentity);
}

export const _private = {
  parseShuttleParkingDiagnosticSnapshot,
  restoreShuttleParkingProblemFromDiagnosticSnapshot,
};
