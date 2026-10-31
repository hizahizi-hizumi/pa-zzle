import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import {
  assessIceFloorMazeDifficulty,
  type IceFloorMazeDifficulty,
  type IceFloorMazeDifficultyAssessment,
  isIceFloorMazeBoardShapeOfDifficulty,
} from "@/games/ice-floor-maze/difficulty";
import {
  analyzeIceFloorMazeDifficulty,
  type IceFloorMazeDifficultyAnalysis,
} from "@/games/ice-floor-maze/problem/difficulty-analysis";
import {
  type IceFloorMazeIdentifiedProblem,
  type IceFloorMazeProblemIdentity,
  isIceFloorMazeProblemIdentity,
  restoreIceFloorMazeProblem,
} from "@/games/ice-floor-maze/problem/problem";
import { isRecordObject } from "@/lib/type-guards";

/**
 * - `difficultyAssessment`: 診断を開いたときの分類方針での、その問題の分類。
 * - `difficultyAnalysis`: 分類の元にした問題の特徴（計画深さ・最少手数・試行手数・到達できる停止点など）。
 */
export type IceFloorMazeDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "ice-floor-maze",
  IceFloorMazeDifficulty,
  IceFloorMazeProblemIdentity
> & {
  difficultyAssessment: IceFloorMazeDifficultyAssessment;
  difficultyAnalysis: IceFloorMazeDifficultyAnalysis;
};

const iceFloorMazeDiagnosticFormat: InternalDiagnosticFormat<IceFloorMazeDiagnosticSnapshot> =
  {
    game: "ice-floor-maze",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isIceFloorMazeProblemIdentity,
    // 分類と特徴は診断を開いたときの写しで、問題の再現には identity だけを使う。読み戻しでは形の大枠だけを確かめる。
    readDetails(
      { difficultyAssessment, difficultyAnalysis },
      { difficulty, problemIdentity },
    ) {
      return isIceFloorMazeBoardShapeOfDifficulty(
        problemIdentity.conditions,
        difficulty,
      ) &&
        isRecordObject(difficultyAssessment) &&
        typeof difficultyAssessment.status === "string" &&
        isRecordObject(difficultyAnalysis) &&
        typeof difficultyAnalysis.status === "string"
        ? {
            difficultyAssessment:
              difficultyAssessment as IceFloorMazeDifficultyAssessment,
            difficultyAnalysis:
              difficultyAnalysis as IceFloorMazeDifficultyAnalysis,
          }
        : undefined;
    },
  };

/**
 * 遊んでいる問題を identity から分析し直して内部診断の snapshot を作る。
 * プレイ時には分析しないため、診断を開いたときだけ呼ぶ。
 */
export function createIceFloorMazeDiagnosticSnapshot(input: {
  difficulty: IceFloorMazeDifficulty;
  problemIdentity: IceFloorMazeProblemIdentity;
  buildRevision: string | null;
}): IceFloorMazeDiagnosticSnapshot {
  const { problem } = restoreIceFloorMazeProblem(input.problemIdentity);
  const difficultyAnalysis = analyzeIceFloorMazeDifficulty(problem);
  return {
    ...createInternalDiagnosticSnapshot(iceFloorMazeDiagnosticFormat, input),
    difficultyAssessment: assessIceFloorMazeDifficulty(difficultyAnalysis),
    difficultyAnalysis,
  };
}

function parseIceFloorMazeDiagnosticSnapshot(
  serialized: string,
): IceFloorMazeDiagnosticSnapshot {
  return parseInternalDiagnosticSnapshot(
    serialized,
    iceFloorMazeDiagnosticFormat,
  );
}

function restoreIceFloorMazeProblemFromDiagnosticSnapshot(
  snapshot: IceFloorMazeDiagnosticSnapshot,
): IceFloorMazeIdentifiedProblem {
  return restoreIceFloorMazeProblem(snapshot.problemIdentity);
}

export const _private = {
  parseIceFloorMazeDiagnosticSnapshot,
  restoreIceFloorMazeProblemFromDiagnosticSnapshot,
};
