import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import {
  assessHakoiriMusumeDifficulty,
  type HakoiriMusumeDifficulty,
  type HakoiriMusumeDifficultyAssessment,
} from "@/games/hakoiri-musume/difficulty";
import {
  analyzeHakoiriMusumeDifficulty,
  type HakoiriMusumeDifficultyAnalysis,
} from "@/games/hakoiri-musume/problem/difficulty-analysis";
import {
  type HakoiriMusumeIdentifiedProblem,
  type HakoiriMusumeProblemIdentity,
  isHakoiriMusumeProblemIdentity,
  restoreHakoiriMusumeProblem,
} from "@/games/hakoiri-musume/problem/problem";
import { isRecordObject } from "@/lib/type-guards";

/**
 * - `difficultyAssessment`: 診断を開いたときの分類方針での、その問題の分類。
 * - `difficultyAnalysis`: 分類の元にした問題の特徴（最短手数・準備の長さ・娘の遠回り・空きなど）。
 */
export type HakoiriMusumeDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "hakoiri-musume",
  HakoiriMusumeDifficulty,
  HakoiriMusumeProblemIdentity
> & {
  difficultyAssessment: HakoiriMusumeDifficultyAssessment;
  difficultyAnalysis: HakoiriMusumeDifficultyAnalysis;
};

const hakoiriMusumeDiagnosticFormat: InternalDiagnosticFormat<HakoiriMusumeDiagnosticSnapshot> =
  {
    game: "hakoiri-musume",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isHakoiriMusumeProblemIdentity,
    // 分類と特徴は診断を開いたときの写しで、問題の再現には identity だけを使う。読み戻しでは形の大枠だけを確かめる。
    readDetails({ difficultyAssessment, difficultyAnalysis }) {
      return isRecordObject(difficultyAssessment) &&
        typeof difficultyAssessment.status === "string" &&
        isRecordObject(difficultyAnalysis) &&
        typeof difficultyAnalysis.status === "string"
        ? {
            difficultyAssessment:
              difficultyAssessment as HakoiriMusumeDifficultyAssessment,
            difficultyAnalysis:
              difficultyAnalysis as HakoiriMusumeDifficultyAnalysis,
          }
        : undefined;
    },
  };

/**
 * 遊んでいる問題を identity から分析し直して内部診断の snapshot を作る。
 * 始めの盤面から行ける全局面をたどるので、プレイ時には分析せず、診断を開いたときだけ呼ぶ。
 */
export function createHakoiriMusumeDiagnosticSnapshot(input: {
  difficulty: HakoiriMusumeDifficulty;
  problemIdentity: HakoiriMusumeProblemIdentity;
  buildRevision: string | null;
}): HakoiriMusumeDiagnosticSnapshot {
  const { problem } = restoreHakoiriMusumeProblem(input.problemIdentity);
  const difficultyAnalysis = analyzeHakoiriMusumeDifficulty(problem);
  return {
    ...createInternalDiagnosticSnapshot(hakoiriMusumeDiagnosticFormat, input),
    difficultyAssessment: assessHakoiriMusumeDifficulty(difficultyAnalysis),
    difficultyAnalysis,
  };
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
