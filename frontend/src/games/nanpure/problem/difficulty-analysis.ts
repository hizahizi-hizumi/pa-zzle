import {
  type NanpureHumanSolveRound,
  type NanpureHumanSolverOptions,
  traceNanpureHumanSolve,
} from "@/games/nanpure/problem/generation/human-solver";
import { classifyNanpureSolutions } from "@/games/nanpure/problem/generation/solver";
import {
  isNanpurePlacementTechnique,
  type NanpureTechnique,
  nanpureTechniques,
} from "@/games/nanpure/problem/technique";
import {
  NANPURE_CELL_COUNT,
  type NanpureBoard,
} from "@/games/nanpure/puzzle/board";

/** 難易度特徴と比べるための問題の規模。挑戦ではなく作業量・生成条件の側の値。 */
export type NanpureScaleMetrics = {
  clueCount: number;
  emptyCellCount: number;
};

/**
 * - `deepestTechnique`: 使わざるを得なかった最も深い手筋。ヒントだけで埋まっている問題では `null`。
 * - `eliminationRoundCount`: 候補を消す手筋が要ったラウンド数。数字を置く手筋では進めなくなった局面の数を表す。
 * - `longestEliminationStreak`: 候補を消す手筋が要るラウンドが続いた最長の回数。消しても次の一手がまだ見えない連続を表す。
 * - `meanAvailablePlacementCount` / `minimumAvailablePlacementCount`: 数字を置くラウンドの前に置けた異なる「マスと数字」の数の平均・最小。次の一手の見つけやすさを表す。
 * - `firstEliminationEmptyCellRatio`: 最初に候補を消す手筋が要った時点の空きマスの割合。深い読みが序盤に要るほど大きい。
 */
export type NanpureHumanSolveFeatures = {
  deepestTechnique: NanpureTechnique | null;
  roundCountByTechnique: Readonly<Record<NanpureTechnique, number>>;
  roundCount: number;
  deepestTechniqueRoundCount: number;
  eliminationRoundCount: number;
  longestEliminationStreak: number;
  meanAvailablePlacementCount: number | null;
  minimumAvailablePlacementCount: number | null;
  singleAvailablePlacementRoundCount: number;
  firstEliminationEmptyCellRatio: number | null;
};

export type NanpureDifficultyAnalysis =
  | {
      status: "analyzed";
      scale: NanpureScaleMetrics;
      features: NanpureHumanSolveFeatures;
    }
  | { status: "unsupported"; scale: NanpureScaleMetrics }
  | {
      status: "invalid";
      reason: "no-solution" | "multiple-solutions";
      scale: NanpureScaleMetrics;
    };

function isEliminationRound(round: NanpureHumanSolveRound): boolean {
  return !isNanpurePlacementTechnique(round.technique);
}

function measureScale(clues: NanpureBoard): NanpureScaleMetrics {
  const clueCount = clues.filter((cell) => cell !== null).length;
  return { clueCount, emptyCellCount: NANPURE_CELL_COUNT - clueCount };
}

function findLongestStreak(
  rounds: readonly NanpureHumanSolveRound[],
  isTarget: (round: NanpureHumanSolveRound) => boolean,
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
  rounds: readonly NanpureHumanSolveRound[],
): NanpureHumanSolveFeatures {
  const deepestDepth = Math.max(
    -1,
    ...rounds.map((round) => nanpureTechniques.indexOf(round.technique)),
  );
  const deepestTechnique = nanpureTechniques[deepestDepth] ?? null;
  const placementCounts = rounds
    .filter((round) => !isEliminationRound(round))
    .map((round) => round.availablePlacementCount);
  const firstEliminationRound = rounds.find(isEliminationRound);

  return {
    deepestTechnique,
    roundCountByTechnique: Object.fromEntries(
      nanpureTechniques.map((technique) => [
        technique,
        rounds.filter((round) => round.technique === technique).length,
      ]),
    ) as Record<NanpureTechnique, number>,
    roundCount: rounds.length,
    deepestTechniqueRoundCount: rounds.filter(
      (round) => round.technique === deepestTechnique,
    ).length,
    eliminationRoundCount: rounds.filter(isEliminationRound).length,
    longestEliminationStreak: findLongestStreak(rounds, isEliminationRound),
    meanAvailablePlacementCount:
      placementCounts.length > 0
        ? placementCounts.reduce((sum, count) => sum + count, 0) /
          placementCounts.length
        : null,
    minimumAvailablePlacementCount:
      placementCounts.length > 0 ? Math.min(...placementCounts) : null,
    singleAvailablePlacementRoundCount: placementCounts.filter(
      (count) => count === 1,
    ).length,
    firstEliminationEmptyCellRatio: firstEliminationRound
      ? firstEliminationRound.emptyCellCount / NANPURE_CELL_COUNT
      : null,
  };
}

export function analyzeNanpureDifficulty(
  clues: NanpureBoard,
  options: NanpureHumanSolverOptions = {},
): NanpureDifficultyAnalysis {
  const scale = measureScale(clues);
  const classification = classifyNanpureSolutions(clues);
  if (classification.status !== "unique") {
    return {
      status: "invalid",
      reason:
        classification.status === "unsolvable"
          ? "no-solution"
          : "multiple-solutions",
      scale,
    };
  }

  const solve = traceNanpureHumanSolve(clues, options);
  if (solve.status !== "solved") {
    return { status: "unsupported", scale };
  }
  return {
    status: "analyzed",
    scale,
    features: summarizeRounds(solve.rounds),
  };
}

export const _private = { findLongestStreak };
