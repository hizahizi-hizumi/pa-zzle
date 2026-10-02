import {
  assessParkingJamDifficulty,
  PARKING_JAM_DIFFICULTY_MODEL_VERSION,
  type ParkingJamDifficulty,
  type ParkingJamDifficultyAssessment,
} from "@/games/parking-jam/difficulty";
import type { ParkingJamDifficultyAnalysis } from "@/games/parking-jam/problem/difficulty-analysis";
import { restoreParkingJamProblem } from "@/games/parking-jam/problem/generator";
import type { ParkingJamProblemIdentity } from "@/games/parking-jam/problem/problem";

export const PARKING_JAM_DIAGNOSTIC_FORMAT_VERSION = 2;

export type ParkingJamDiagnosticSnapshot = {
  formatVersion: typeof PARKING_JAM_DIAGNOSTIC_FORMAT_VERSION;
  game: "parking-jam";
  difficulty: ParkingJamDifficulty;
  problemIdentity: ParkingJamProblemIdentity;
  difficultyModelVersion: typeof PARKING_JAM_DIFFICULTY_MODEL_VERSION;
  difficultyAssessment: ParkingJamDifficultyAssessment;
  difficultyAnalysis: ParkingJamDifficultyAnalysis;
  buildRevision: string | null;
};

/**
 * 遊んでいる問題を identity から解析し直して内部診断の snapshot を作る。
 * プレイ時には解析しないため、診断を開いたときだけ呼ぶ。
 */
export function createParkingJamDiagnosticSnapshot({
  difficulty,
  problemIdentity,
  buildRevision,
}: {
  difficulty: ParkingJamDifficulty;
  problemIdentity: ParkingJamProblemIdentity;
  buildRevision: string | null;
}): ParkingJamDiagnosticSnapshot {
  const { difficultyAnalysis } = restoreParkingJamProblem(problemIdentity);
  return {
    formatVersion: PARKING_JAM_DIAGNOSTIC_FORMAT_VERSION,
    game: "parking-jam",
    difficulty,
    problemIdentity: {
      ...problemIdentity,
      conditions: { ...problemIdentity.conditions },
    },
    difficultyModelVersion: PARKING_JAM_DIFFICULTY_MODEL_VERSION,
    difficultyAssessment: assessParkingJamDifficulty(difficultyAnalysis),
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
