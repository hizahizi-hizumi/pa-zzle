import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import {
  assessHamiltonianPathDifficulty,
  type HamiltonianPathDifficulty,
  type HamiltonianPathDifficultyAssessment,
} from "@/games/hamiltonian-path/difficulty";
import {
  analyzeHamiltonianPathDifficulty,
  type HamiltonianPathDifficultyAnalysis,
} from "@/games/hamiltonian-path/problem/difficulty-analysis";
import {
  countHamiltonianPathSolutions,
  type HamiltonianPathSolutionSearchResult,
} from "@/games/hamiltonian-path/problem/generation/solver";
import { measureHamiltonianPathStraightRatio } from "@/games/hamiltonian-path/problem/generation/straightness";
import { getHamiltonianPathSymmetryKey } from "@/games/hamiltonian-path/problem/generation/symmetry";
import {
  type HamiltonianPathProblem,
  type HamiltonianPathProblemIdentity,
  isHamiltonianPathProblemIdentity,
} from "@/games/hamiltonian-path/problem/problem";
import type { HamiltonianPathPooledProblem } from "@/games/hamiltonian-path/problem/problem-pool";
import { restoreHamiltonianPathProblem } from "@/games/hamiltonian-path/problem-selection";
import {
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isRecordObject,
} from "@/lib/type-guards";

/** 一意性を確かめた探索の結果。見つけた解そのものは `solution` に分けて持つ。 */
type HamiltonianPathUniquenessCheck = Pick<
  HamiltonianPathSolutionSearchResult,
  "status" | "solutionCount" | "searchStepCount"
>;

/**
 * 検証情報を開いたときに、遊んでいる問題を解き直し・分析し直して求めた値。プレイ中は求めない。
 * - `symmetryKey`: 回転・反転で重なる盤面に共通の正規化キー（問題集の同型除外に使うもの）。
 * - `uniqueness`: 生成器と同じ探索量の上限で、解を2つまで数えた結果。
 * - `solution`: 正解の道（始点からのマス番号）。解がただ1つと確かめられたときだけ持つ。
 * - `straightRatio`: 正解の道の直進率。`solution` が無ければ `null`。
 * - `difficultyAnalysis`: 人間向け解法器の経過（推論段階ごとの発火数・仮置き・先読みの手数）と、描画視点の分岐。
 * - `difficultyAssessment`: 分析から決めたレベル（または提供範囲外の理由）。出題した難易度とは別に、今の規則で分類し直す。
 */
export type HamiltonianPathDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "hamiltonian-path",
  HamiltonianPathDifficulty,
  HamiltonianPathProblemIdentity
> & {
  symmetryKey: string;
  uniqueness: HamiltonianPathUniquenessCheck;
  solution: readonly number[] | null;
  straightRatio: number | null;
  difficultyAnalysis: HamiltonianPathDifficultyAnalysis;
  difficultyAssessment: HamiltonianPathDifficultyAssessment;
};

function isUniquenessCheck(
  value: unknown,
): value is HamiltonianPathUniquenessCheck {
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

const hamiltonianPathDiagnosticFormat: InternalDiagnosticFormat<HamiltonianPathDiagnosticSnapshot> =
  {
    game: "hamiltonian-path",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isHamiltonianPathProblemIdentity,
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
              difficultyAnalysis as HamiltonianPathDifficultyAnalysis,
            difficultyAssessment:
              difficultyAssessment as HamiltonianPathDifficultyAssessment,
          }
        : undefined;
    },
  };

function findUniqueSolution(
  problem: HamiltonianPathProblem,
): Pick<HamiltonianPathDiagnosticSnapshot, "uniqueness" | "solution"> {
  const { status, solutionCount, searchStepCount, firstSolutions } =
    countHamiltonianPathSolutions(problem);
  const isUnique = status === "complete" && solutionCount === 1;
  return {
    uniqueness: { status, solutionCount, searchStepCount },
    solution: isUnique ? [...firstSolutions[0]!] : null,
  };
}

/**
 * 検証情報としてコピーする値。問題の再現に要る identity と出題した難易度・ビルドに、
 * 遊んでいる問題を解き直した正解の道と、難易度を分析し直した結果を添える。
 * 解法器と描画視点の分析を走らせるので、検証情報を開いたときだけ呼ぶ。
 */
export function createHamiltonianPathDiagnosticSnapshot({
  problem,
  ...input
}: {
  difficulty: HamiltonianPathDifficulty;
  problemIdentity: HamiltonianPathProblemIdentity;
  problem: HamiltonianPathProblem;
  buildRevision: string | null;
}): HamiltonianPathDiagnosticSnapshot {
  const { uniqueness, solution } = findUniqueSolution(problem);
  const difficultyAnalysis = analyzeHamiltonianPathDifficulty(problem);
  return {
    ...createInternalDiagnosticSnapshot(hamiltonianPathDiagnosticFormat, input),
    symmetryKey: getHamiltonianPathSymmetryKey(problem),
    uniqueness,
    solution,
    straightRatio: solution
      ? measureHamiltonianPathStraightRatio(solution)
      : null,
    difficultyAnalysis: structuredClone(difficultyAnalysis),
    difficultyAssessment: assessHamiltonianPathDifficulty(difficultyAnalysis),
  };
}

function parseHamiltonianPathDiagnosticSnapshot(
  serialized: string,
): HamiltonianPathDiagnosticSnapshot {
  return parseInternalDiagnosticSnapshot(
    serialized,
    hamiltonianPathDiagnosticFormat,
  );
}

/** 問題集に無い identity は `null` を返す。 */
function restoreHamiltonianPathProblemFromDiagnosticSnapshot(
  snapshot: HamiltonianPathDiagnosticSnapshot,
): HamiltonianPathPooledProblem | null {
  return restoreHamiltonianPathProblem(snapshot.problemIdentity);
}

export const _private = {
  parseHamiltonianPathDiagnosticSnapshot,
  restoreHamiltonianPathProblemFromDiagnosticSnapshot,
};
