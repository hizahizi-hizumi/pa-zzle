import {
  getTakuzuTechniqueDepth,
  type TakuzuHumanSolveRound,
  type TakuzuHumanSolverOptions,
  type TakuzuTechnique,
  takuzuTechniques,
  traceTakuzuHumanSolve,
} from "@/games/takuzu/problem/generation/human-solver";
import { countTakuzuSolutions } from "@/games/takuzu/problem/generation/solver";
import type { TakuzuProblem } from "@/games/takuzu/problem/problem";
import type { TakuzuBoard } from "@/games/takuzu/puzzle/board";

/** 難易度特徴と比べるための問題の規模。挑戦ではなく作業量・生成条件の側の値。 */
export type TakuzuScaleMetrics = {
  cellCount: number;
  givenCount: number;
  emptyCellCount: number;
};

/**
 * 人間向け解法器で解き切った経過から求めた特徴。
 * 「行・列を読む手筋」は C 残り1個・D 重複の回避・E 一般の行候補を指す。
 * - `deepestTechnique`: 使わざるを得なかった最も深い手筋。初期配置だけで埋まっている問題では `null`。
 * - `lineReadingRoundCount`: 行・列を読む手筋が要ったラウンド数。
 * - `duplicateAvoidanceRoundCount`: 完成済みの行・列との比較が要ったラウンド数（D と、重複の除外が要った E）。
 * - `longestLineReadingStreak`: 行・列を読む手筋が要るラウンドが続いた最長の回数。深い読みの直後にまた深い読みが要る連続を表す。
 * - `meanSourceCount` / `minimumSourceCount`: ラウンドごとの、確定を与える場所の数の平均・最小。次の一手の見つけやすさを表す。
 * - `singleSourceRoundCount`: 確定を与える場所が盤面に1か所しかないラウンド数。
 * - `firstLineReadingEmptyCellRatio`: 最初に行・列を読む手筋が要った時点の空きマスの割合。深い読みが序盤に要るほど大きい。
 */
export type TakuzuHumanSolveFeatures = {
  deepestTechnique: TakuzuTechnique | null;
  roundCountByTechnique: Readonly<Record<TakuzuTechnique, number>>;
  roundCount: number;
  lineReadingRoundCount: number;
  duplicateAvoidanceRoundCount: number;
  longestLineReadingStreak: number;
  meanSourceCount: number | null;
  minimumSourceCount: number | null;
  singleSourceRoundCount: number;
  firstLineReadingEmptyCellRatio: number | null;
};

/**
 * - `analyzed`: 一意解で、人間向け解法器で推測なしに解き切れた。
 * - `unsupported`: 一意解だが、1本の行・列を読む手筋だけでは解き切れない（評価不能）。
 * - `invalid`: 解が無い、または2つ以上ある（成立しない）。
 */
export type TakuzuDifficultyAnalysis =
  | {
      status: "analyzed";
      scale: TakuzuScaleMetrics;
      features: TakuzuHumanSolveFeatures;
    }
  | { status: "unsupported"; scale: TakuzuScaleMetrics }
  | {
      status: "invalid";
      reason: "no-solution" | "multiple-solutions";
      scale: TakuzuScaleMetrics;
    };

const lineReadingTechniques: ReadonlySet<TakuzuTechnique> = new Set([
  "single-remaining",
  "duplicate-avoidance",
  "general-line",
]);

function isLineReadingRound(round: TakuzuHumanSolveRound): boolean {
  return lineReadingTechniques.has(round.technique);
}

function measureScale(givens: TakuzuBoard): TakuzuScaleMetrics {
  const givenCount = givens.cells.filter((cell) => cell !== null).length;
  return {
    cellCount: givens.cells.length,
    givenCount,
    emptyCellCount: givens.cells.length - givenCount,
  };
}

function findLongestStreak(
  rounds: readonly TakuzuHumanSolveRound[],
  isTarget: (round: TakuzuHumanSolveRound) => boolean,
): number {
  let longest = 0;
  let current = 0;
  for (const round of rounds) {
    current = isTarget(round) ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

function summarizeRounds(
  rounds: readonly TakuzuHumanSolveRound[],
  cellCount: number,
): TakuzuHumanSolveFeatures {
  const sourceCounts = rounds.map((round) => round.sourceCount);
  const deepestDepth = Math.max(
    -1,
    ...rounds.map((round) => getTakuzuTechniqueDepth(round.technique)),
  );
  const firstLineReadingRound = rounds.find(isLineReadingRound);

  return {
    deepestTechnique: takuzuTechniques[deepestDepth] ?? null,
    roundCountByTechnique: Object.fromEntries(
      takuzuTechniques.map((technique) => [
        technique,
        rounds.filter((round) => round.technique === technique).length,
      ]),
    ) as Record<TakuzuTechnique, number>,
    roundCount: rounds.length,
    lineReadingRoundCount: rounds.filter(isLineReadingRound).length,
    duplicateAvoidanceRoundCount: rounds.filter(
      (round) => round.requiresDuplicateAvoidance,
    ).length,
    longestLineReadingStreak: findLongestStreak(rounds, isLineReadingRound),
    meanSourceCount:
      rounds.length > 0
        ? sourceCounts.reduce((sum, count) => sum + count, 0) / rounds.length
        : null,
    minimumSourceCount: rounds.length > 0 ? Math.min(...sourceCounts) : null,
    singleSourceRoundCount: sourceCounts.filter((count) => count === 1).length,
    firstLineReadingEmptyCellRatio: firstLineReadingRound
      ? firstLineReadingRound.emptyCellCount / cellCount
      : null,
  };
}

/** 初期配置の一意性を確かめたうえで、人間向け解法器の経過を特徴へまとめる。 */
export function analyzeTakuzuDifficulty(
  { givens }: TakuzuProblem,
  options: TakuzuHumanSolverOptions = {},
): TakuzuDifficultyAnalysis {
  const scale = measureScale(givens);
  const { solutionCount } = countTakuzuSolutions(givens);
  if (solutionCount !== 1) {
    return {
      status: "invalid",
      reason: solutionCount === 0 ? "no-solution" : "multiple-solutions",
      scale,
    };
  }

  const solve = traceTakuzuHumanSolve(givens, options);
  if (solve.status !== "solved") {
    return { status: "unsupported", scale };
  }
  return {
    status: "analyzed",
    scale,
    features: summarizeRounds(solve.rounds, scale.cellCount),
  };
}

export const _private = { findLongestStreak };
