import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import {
  assessHitofudePuzzleDifficulty,
  type HitofudePuzzleDifficulty,
  type HitofudePuzzleDifficultyAssessment,
} from "@/games/hitofude-puzzle/difficulty";
import {
  analyzeHitofudePuzzleDifficulty,
  type HitofudePuzzleDifficultyAnalysis,
  searchHitofudePuzzleSolutionsForAnalysis,
} from "@/games/hitofude-puzzle/problem/difficulty-analysis";
import type { HitofudePuzzleSolutionSearchResult } from "@/games/hitofude-puzzle/problem/generation/solver";
import { measureHitofudePuzzleStraightRatio } from "@/games/hitofude-puzzle/problem/generation/straightness";
import { getHitofudePuzzleSymmetryKey } from "@/games/hitofude-puzzle/problem/generation/symmetry";
import {
  type HitofudePuzzleProblem,
  type HitofudePuzzleProblemIdentity,
  isHitofudePuzzleProblemIdentity,
} from "@/games/hitofude-puzzle/problem/problem";
import type { HitofudePuzzlePooledProblem } from "@/games/hitofude-puzzle/problem/problem-pool";
import { restoreHitofudePuzzleProblem } from "@/games/hitofude-puzzle/problem-selection";
import {
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isRecordObject,
} from "@/lib/type-guards";

/** 一意性を確かめた探索の結果。見つけた解そのものは `solution` に分けて持つ。 */
type HitofudePuzzleUniquenessCheck = Pick<
  HitofudePuzzleSolutionSearchResult,
  "status" | "solutionCount" | "searchStepCount"
>;

/**
 * 検証情報を開いたときに、遊んでいる問題を解き直し・分析し直して求めた値。プレイ中は求めない。
 * - `symmetryKey`: 回転・反転で重なる盤面に共通の正規化キー（問題集の同型除外に使うもの）。
 * - `uniqueness`: 難易度の分析と同じ探索（探索量の上限も同じ）で、解を2つまで数えた結果。
 * - `solution`: 正解の道（始点からのマス番号）。解がただ1つと確かめられたときだけ持つ。
 * - `straightRatio`: 正解の道の直進率。`solution` が無ければ `null`。
 * - `difficultyAnalysis`: 人間向け解法器の経過（推論段階ごとの発火数・仮置き・先読みの手数）と、描画視点の分岐。
 * - `difficultyAssessment`: 分析から決めたレベル（または提供範囲外の理由）。出題した難易度とは別に、今の規則で分類し直す。
 */
export type HitofudePuzzleDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "hitofude-puzzle",
  HitofudePuzzleDifficulty,
  HitofudePuzzleProblemIdentity
> & {
  symmetryKey: string;
  uniqueness: HitofudePuzzleUniquenessCheck;
  solution: readonly number[] | null;
  straightRatio: number | null;
  difficultyAnalysis: HitofudePuzzleDifficultyAnalysis;
  difficultyAssessment: HitofudePuzzleDifficultyAssessment;
};

function isUniquenessCheck(
  value: unknown,
): value is HitofudePuzzleUniquenessCheck {
  return (
    isRecordObject(value) &&
    (value.status === "complete" || value.status === "search-limit-reached") &&
    isNonNegativeInteger(value.solutionCount) &&
    isNonNegativeInteger(value.searchStepCount)
  );
}

function isSolution(value: unknown): value is readonly number[] | null {
  return (
    value === null ||
    (Array.isArray(value) && value.every((cell) => isNonNegativeInteger(cell)))
  );
}

const hitofudePuzzleDiagnosticFormat: InternalDiagnosticFormat<HitofudePuzzleDiagnosticSnapshot> =
  {
    game: "hitofude-puzzle",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isHitofudePuzzleProblemIdentity,
    // 解・分析・分類は診断を開いたときの写しで、問題の再現には identity だけを使う。読み戻しでは形の大枠だけを確かめる。
    readDetails({
      symmetryKey,
      uniqueness,
      solution,
      straightRatio,
      difficultyAnalysis,
      difficultyAssessment,
    }) {
      return typeof symmetryKey === "string" &&
        isUniquenessCheck(uniqueness) &&
        isSolution(solution) &&
        (straightRatio === null || isNonNegativeFiniteNumber(straightRatio)) &&
        isRecordObject(difficultyAnalysis) &&
        typeof difficultyAnalysis.status === "string" &&
        isRecordObject(difficultyAnalysis.scale) &&
        isRecordObject(difficultyAssessment) &&
        typeof difficultyAssessment.status === "string"
        ? {
            symmetryKey,
            uniqueness,
            solution,
            straightRatio,
            difficultyAnalysis:
              difficultyAnalysis as HitofudePuzzleDifficultyAnalysis,
            difficultyAssessment:
              difficultyAssessment as HitofudePuzzleDifficultyAssessment,
          }
        : undefined;
    },
  };

/**
 * 検証情報としてコピーする値。問題の再現に要る identity と出題した難易度・ビルドに、
 * 遊んでいる問題を解き直した正解の道と、難易度を分析し直した結果を添える。
 * 解法器と描画視点の分析を走らせるので、検証情報を開いたときだけ呼ぶ。
 */
export function createHitofudePuzzleDiagnosticSnapshot({
  problem,
  ...input
}: {
  difficulty: HitofudePuzzleDifficulty;
  problemIdentity: HitofudePuzzleProblemIdentity;
  problem: HitofudePuzzleProblem;
  buildRevision: string | null;
}): HitofudePuzzleDiagnosticSnapshot {
  const solutionSearch = searchHitofudePuzzleSolutionsForAnalysis(problem);
  const { status, solutionCount, searchStepCount, firstSolutions } =
    solutionSearch;
  const solution =
    status === "complete" && solutionCount === 1
      ? [...firstSolutions[0]!]
      : null;
  const difficultyAnalysis = analyzeHitofudePuzzleDifficulty(
    problem,
    {},
    solutionSearch,
  );
  return {
    ...createInternalDiagnosticSnapshot(hitofudePuzzleDiagnosticFormat, input),
    symmetryKey: getHitofudePuzzleSymmetryKey(problem),
    uniqueness: { status, solutionCount, searchStepCount },
    solution,
    straightRatio: solution
      ? measureHitofudePuzzleStraightRatio(solution)
      : null,
    difficultyAnalysis: structuredClone(difficultyAnalysis),
    difficultyAssessment: assessHitofudePuzzleDifficulty(difficultyAnalysis),
  };
}

function parseHitofudePuzzleDiagnosticSnapshot(
  serialized: string,
): HitofudePuzzleDiagnosticSnapshot {
  return parseInternalDiagnosticSnapshot(
    serialized,
    hitofudePuzzleDiagnosticFormat,
  );
}

/** 問題集に無い identity は `null` を返す。 */
function restoreHitofudePuzzleProblemFromDiagnosticSnapshot(
  snapshot: HitofudePuzzleDiagnosticSnapshot,
): HitofudePuzzlePooledProblem | null {
  return restoreHitofudePuzzleProblem(snapshot.problemIdentity);
}

export const _private = {
  parseHitofudePuzzleDiagnosticSnapshot,
  restoreHitofudePuzzleProblemFromDiagnosticSnapshot,
};
