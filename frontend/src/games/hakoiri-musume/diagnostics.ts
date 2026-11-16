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
  type HakoiriMusumeDifficultyFeatures,
} from "@/games/hakoiri-musume/problem/difficulty-analysis";
import {
  type HakoiriMusumeIdentifiedProblem,
  type HakoiriMusumeProblemIdentity,
  isCurrentHakoiriMusumeProblemIdentity,
  restoreHakoiriMusumeProblem,
} from "@/games/hakoiri-musume/problem/problem";
import {
  type HakoiriMusumeWorkload,
  listHakoiriMusumePoolEntries,
} from "@/games/hakoiri-musume/problem/problem-pool";
import {
  countHakoiriMusumeCells,
  listHakoiriMusumePieceCells,
} from "@/games/hakoiri-musume/puzzle/board";
import { isRecordObject } from "@/lib/type-guards";

/**
 * 診断に出す問題の特徴。
 * - `analyzed`・`invalid`: 診断を開いたときに、始めの盤面から行ける全局面をたどって分析し直した結果。
 * - `pooled`: 問題集の値。問題集を作るときに分析して分類し、`--verify` で確かめた最短手数と準備の長さ（問題集が持てば
 *   娘の遠回りと最短の解の準備も）に、盤面から数えた空きを添える。
 * - `recorded`: 問題集に無い問題の、記録したときの最短手数と準備の長さに、盤面から数えた空きを添える。
 * 全局面のたどりは数秒〜十数秒かかるので、問題集にある問題と記録のある問題は分析し直さない。
 */
export type HakoiriMusumeDiagnosticAnalysis =
  | HakoiriMusumeDifficultyAnalysis
  | {
      status: "pooled";
      features: Pick<
        HakoiriMusumeDifficultyFeatures,
        "optimalMoveCount" | "preparationLength" | "emptyCellCount"
      > &
        Partial<
          Pick<
            HakoiriMusumeDifficultyFeatures,
            "daughterDetourCount" | "shortestPreparationLength"
          >
        >;
    }
  | {
      status: "recorded";
      features: Pick<
        HakoiriMusumeDifficultyFeatures,
        "optimalMoveCount" | "preparationLength" | "emptyCellCount"
      >;
    };

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
  difficultyAnalysis: HakoiriMusumeDiagnosticAnalysis;
};

const hakoiriMusumeDiagnosticFormat: InternalDiagnosticFormat<HakoiriMusumeDiagnosticSnapshot> =
  {
    game: "hakoiri-musume",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isCurrentHakoiriMusumeProblemIdentity,
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
              difficultyAnalysis as HakoiriMusumeDiagnosticAnalysis,
          }
        : undefined;
    },
  };

/**
 * 遊んでいる問題の内部診断の snapshot を作る。問題集にある問題は、問題集の分類と値を引くだけにする。
 * 問題集に無い問題は、`recordedWorkload`（記録したときの作業の量）を渡せばその値を出し、渡さなければ始めの盤面から
 * 行ける全局面をたどって分析し直す。プレイ時には呼ばず、診断を開いたときだけ呼ぶ。
 */
export function createHakoiriMusumeDiagnosticSnapshot({
  recordedWorkload,
  ...input
}: {
  difficulty: HakoiriMusumeDifficulty;
  problemIdentity: HakoiriMusumeProblemIdentity;
  buildRevision: string | null;
  recordedWorkload?: HakoiriMusumeWorkload;
}): HakoiriMusumeDiagnosticSnapshot {
  const { problem } = restoreHakoiriMusumeProblem(input.problemIdentity);
  const { layout } = problem;
  const emptyCellCount =
    countHakoiriMusumeCells(layout) -
    layout.walls.length -
    problem.pieces.flatMap((piece) =>
      listHakoiriMusumePieceCells(layout, piece),
    ).length;
  const pooled = listHakoiriMusumePoolEntries(input.difficulty).find(
    ([board]) => board === input.problemIdentity.seed,
  );
  if (pooled) {
    const [
      ,
      optimalMoveCount,
      preparationLength,
      daughterDetourCount,
      shortestPreparationLength,
    ] = pooled;
    return {
      ...createInternalDiagnosticSnapshot(hakoiriMusumeDiagnosticFormat, input),
      difficultyAssessment: {
        status: "classified",
        difficulty: input.difficulty,
      },
      difficultyAnalysis: {
        status: "pooled",
        features: {
          optimalMoveCount,
          preparationLength,
          emptyCellCount,
          ...(daughterDetourCount === undefined ? {} : { daughterDetourCount }),
          ...(shortestPreparationLength === undefined
            ? {}
            : { shortestPreparationLength }),
        },
      },
    };
  }
  if (recordedWorkload) {
    return {
      ...createInternalDiagnosticSnapshot(hakoiriMusumeDiagnosticFormat, input),
      difficultyAssessment: {
        status: "classified",
        difficulty: input.difficulty,
      },
      difficultyAnalysis: {
        status: "recorded",
        features: { ...recordedWorkload, emptyCellCount },
      },
    };
  }
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
