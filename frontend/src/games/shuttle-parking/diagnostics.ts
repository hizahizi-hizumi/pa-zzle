import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import {
  assessShuttleParkingDifficulty,
  SHUTTLE_PARKING_DIFFICULTY_MODEL_VERSION,
  type ShuttleParkingDifficulty,
  type ShuttleParkingDifficultyAssessment,
} from "@/games/shuttle-parking/difficulty";
import {
  analyzeShuttleParkingDifficulty,
  type ShuttleParkingDifficultyAnalysis,
} from "@/games/shuttle-parking/problem/difficulty-analysis";
import {
  isCurrentShuttleParkingProblemIdentity,
  restoreShuttleParkingProblem,
  type ShuttleParkingIdentifiedProblem,
  type ShuttleParkingProblemIdentity,
} from "@/games/shuttle-parking/problem/problem";
import { isRecordObject } from "@/lib/type-guards";

/**
 * - `difficultyModelVersion` / `difficultyAssessment`: 診断を開いたときの判定モデルの版と、その問題の判定。
 * - `difficultyAnalysis`: 判定の元にした問題の特徴（罠の重さは採点の基準時間にも使う）。
 */
export type ShuttleParkingDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "shuttle-parking",
  ShuttleParkingDifficulty,
  ShuttleParkingProblemIdentity
> & {
  difficultyModelVersion: typeof SHUTTLE_PARKING_DIFFICULTY_MODEL_VERSION;
  difficultyAssessment: ShuttleParkingDifficultyAssessment;
  difficultyAnalysis: ShuttleParkingDifficultyAnalysis;
};

const shuttleParkingDiagnosticFormat: InternalDiagnosticFormat<ShuttleParkingDiagnosticSnapshot> =
  {
    game: "shuttle-parking",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isCurrentShuttleParkingProblemIdentity,
    // 判定と特徴は診断を開いたときの写しで、問題の再現には identity だけを使う。読み戻しでは形の大枠だけを確かめる。
    readDetails({
      difficultyModelVersion,
      difficultyAssessment,
      difficultyAnalysis,
    }) {
      return difficultyModelVersion ===
        SHUTTLE_PARKING_DIFFICULTY_MODEL_VERSION &&
        isRecordObject(difficultyAssessment) &&
        typeof difficultyAssessment.status === "string" &&
        isRecordObject(difficultyAnalysis) &&
        typeof difficultyAnalysis.status === "string"
        ? {
            difficultyModelVersion,
            difficultyAssessment:
              difficultyAssessment as ShuttleParkingDifficultyAssessment,
            difficultyAnalysis:
              difficultyAnalysis as ShuttleParkingDifficultyAnalysis,
          }
        : undefined;
    },
  };

/** プレイ時には問題を分析しないため、診断を開いたときだけ呼ぶ。 */
export function createShuttleParkingDiagnosticSnapshot(input: {
  difficulty: ShuttleParkingDifficulty;
  problemIdentity: ShuttleParkingProblemIdentity;
  buildRevision: string | null;
}): ShuttleParkingDiagnosticSnapshot {
  const difficultyAnalysis = analyzeShuttleParkingDifficulty(
    restoreShuttleParkingProblem(input.problemIdentity).problem,
  );
  return {
    ...createInternalDiagnosticSnapshot(shuttleParkingDiagnosticFormat, input),
    difficultyModelVersion: SHUTTLE_PARKING_DIFFICULTY_MODEL_VERSION,
    difficultyAssessment: assessShuttleParkingDifficulty(difficultyAnalysis),
    difficultyAnalysis,
  };
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
