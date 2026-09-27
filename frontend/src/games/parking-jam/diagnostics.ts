import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import type { ParkingJamDifficultyAnalysis } from "@/games/parking-jam/problem/difficulty-analysis";
import type { ParkingJamProblemIdentity } from "@/games/parking-jam/problem/problem";

export const PARKING_JAM_DIAGNOSTIC_FORMAT_VERSION = 1;

export type ParkingJamDiagnosticSnapshot = {
  formatVersion: typeof PARKING_JAM_DIAGNOSTIC_FORMAT_VERSION;
  game: "parking-jam";
  difficulty: ParkingJamDifficulty;
  problemIdentity: ParkingJamProblemIdentity;
  difficultyAnalysis: ParkingJamDifficultyAnalysis;
  buildRevision: string | null;
};

export function createParkingJamDiagnosticSnapshot({
  difficulty,
  problemIdentity,
  difficultyAnalysis,
  buildRevision,
}: {
  difficulty: ParkingJamDifficulty;
  problemIdentity: ParkingJamProblemIdentity;
  difficultyAnalysis: ParkingJamDifficultyAnalysis;
  buildRevision: string | null;
}): ParkingJamDiagnosticSnapshot {
  return {
    formatVersion: PARKING_JAM_DIAGNOSTIC_FORMAT_VERSION,
    game: "parking-jam",
    difficulty,
    problemIdentity: {
      ...problemIdentity,
      conditions: { ...problemIdentity.conditions },
    },
    difficultyAnalysis: {
      ...difficultyAnalysis,
      features: { ...difficultyAnalysis.features },
    },
    buildRevision,
  };
}

export function serializeParkingJamDiagnosticSnapshot(
  snapshot: ParkingJamDiagnosticSnapshot,
): string {
  return JSON.stringify(snapshot, null, 2);
}
