import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import {
  assessParkingJamDifficulty,
  PARKING_JAM_DIFFICULTY_MODEL_VERSION,
  type ParkingJamDifficulty,
  type ParkingJamDifficultyAssessment,
} from "@/games/parking-jam/difficulty";
import type { ParkingJamDifficultyAnalysis } from "@/games/parking-jam/problem/difficulty-analysis";
import {
  restoreParkingJamProblem,
  restoreParkingJamProblemWithoutAnalysis,
} from "@/games/parking-jam/problem/generator";
import {
  isParkingJamProblemIdentity,
  type ParkingJamIdentifiedProblem,
  type ParkingJamProblemIdentity,
} from "@/games/parking-jam/problem/problem";
import { isRecordObject } from "@/lib/type-guards";

/**
 * - `difficultyModelVersion` / `difficultyAssessment`: 診断を開いたときの判定モデルの版と、その問題の判定。
 * - `difficultyAnalysis`: 判定の元にした問題の特徴。
 */
export type ParkingJamDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "parking-jam",
  ParkingJamDifficulty,
  ParkingJamProblemIdentity
> & {
  difficultyModelVersion: typeof PARKING_JAM_DIFFICULTY_MODEL_VERSION;
  difficultyAssessment: ParkingJamDifficultyAssessment;
  difficultyAnalysis: ParkingJamDifficultyAnalysis;
};

const parkingJamDiagnosticFormat: InternalDiagnosticFormat<ParkingJamDiagnosticSnapshot> =
  {
    game: "parking-jam",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isParkingJamProblemIdentity,
    // 判定と特徴は診断を開いたときの写しで、問題の再現には identity だけを使う。読み戻しでは形の大枠だけを確かめる。
    readDetails({
      difficultyModelVersion,
      difficultyAssessment,
      difficultyAnalysis,
    }) {
      return difficultyModelVersion === PARKING_JAM_DIFFICULTY_MODEL_VERSION &&
        isRecordObject(difficultyAssessment) &&
        typeof difficultyAssessment.status === "string" &&
        isRecordObject(difficultyAnalysis) &&
        isRecordObject(difficultyAnalysis.features)
        ? {
            difficultyModelVersion,
            difficultyAssessment:
              difficultyAssessment as ParkingJamDifficultyAssessment,
            difficultyAnalysis:
              difficultyAnalysis as ParkingJamDifficultyAnalysis,
          }
        : undefined;
    },
  };

/**
 * 遊んでいる問題を identity から解析し直して内部診断の snapshot を作る。
 * プレイ時には解析しないため、診断を開いたときだけ呼ぶ。
 */
export function createParkingJamDiagnosticSnapshot(input: {
  difficulty: ParkingJamDifficulty;
  problemIdentity: ParkingJamProblemIdentity;
  buildRevision: string | null;
}): ParkingJamDiagnosticSnapshot {
  const { difficultyAnalysis } = restoreParkingJamProblem(
    input.problemIdentity,
  );
  return {
    ...createInternalDiagnosticSnapshot(parkingJamDiagnosticFormat, input),
    difficultyModelVersion: PARKING_JAM_DIFFICULTY_MODEL_VERSION,
    difficultyAssessment: assessParkingJamDifficulty(difficultyAnalysis),
    difficultyAnalysis: structuredClone(difficultyAnalysis),
  };
}

function parseParkingJamDiagnosticSnapshot(
  serialized: string,
): ParkingJamDiagnosticSnapshot {
  return parseInternalDiagnosticSnapshot(
    serialized,
    parkingJamDiagnosticFormat,
  );
}

function restoreParkingJamProblemFromDiagnosticSnapshot(
  snapshot: ParkingJamDiagnosticSnapshot,
): ParkingJamIdentifiedProblem {
  return restoreParkingJamProblemWithoutAnalysis(snapshot.problemIdentity);
}

export const _private = {
  parseParkingJamDiagnosticSnapshot,
  restoreParkingJamProblemFromDiagnosticSnapshot,
};
