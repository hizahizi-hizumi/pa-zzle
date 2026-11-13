import {
  type ReflectionHumanSolveOptions,
  type ReflectionReasoningLevel,
  traceReflectionHumanSolve,
} from "@/games/reflection/problem/generation/human-solver";
import {
  countReflectionSolutions,
  REFLECTION_UNIQUENESS_SEARCH_STEP_LIMIT,
} from "@/games/reflection/problem/generation/solver";
import { traceReflectionTrialSolve } from "@/games/reflection/problem/generation/trial-solver";
import type { ReflectionProblem } from "@/games/reflection/problem/problem";
import {
  getReflectionInventoryPieceCount,
  reflectionPieces,
} from "@/games/reflection/puzzle/board";

export type ReflectionScaleMetrics = {
  size: number;
  cellCount: number;
  clueCount: number;
  pieceCount: number;
  pieceKindCount: number;
};

export type ReflectionReasoningFeatures = {
  highestLevel: ReflectionReasoningLevel;
  fixedPieceCountByLevel: readonly [number, number, number, number, number];
  propagationRoundCount: number;
  assumptionTestCount: number;
  assumptionEliminationCount: number;
};

export type ReflectionTrialFeatures = {
  solved: boolean;
  moveCount: number;
  retryCount: number;
};

/**
 * - `analyzed`: 一意解で、推論レベル1〜5で置き場所を決め切れた。
 * - `unsupported`: 一意解だが、推論レベル5まで使っても決まらないマスが残る（評価不能）。
 * - `invalid`: 解が無い、2つ以上ある、または一意性を確かめ切れない（成立しない）。
 */
export type ReflectionDifficultyAnalysis =
  | {
      status: "analyzed";
      scale: ReflectionScaleMetrics;
      features: ReflectionReasoningFeatures;
      trial: ReflectionTrialFeatures;
    }
  | {
      status: "unsupported";
      reason: "unresolved" | "assumption-limit-reached";
      scale: ReflectionScaleMetrics;
      unresolvedCellCount: number;
    }
  | {
      status: "invalid";
      reason: "no-solution" | "multiple-solutions" | "search-limit-reached";
      scale: ReflectionScaleMetrics;
    };

function measureScale({
  size,
  inventory,
  clues,
}: ReflectionProblem): ReflectionScaleMetrics {
  return {
    size,
    cellCount: size * size,
    clueCount: clues.length,
    pieceCount: getReflectionInventoryPieceCount(inventory),
    pieceKindCount: reflectionPieces.filter((piece) => inventory[piece] > 0)
      .length,
  };
}

function measureTrialFeatures(
  problem: ReflectionProblem,
): ReflectionTrialFeatures {
  const { status, moveCount, retryCount } = traceReflectionTrialSolve(problem);
  return { solved: status === "solved", moveCount, retryCount };
}

export function analyzeReflectionDifficulty(
  problem: ReflectionProblem,
  options: ReflectionHumanSolveOptions = {},
): ReflectionDifficultyAnalysis {
  const scale = measureScale(problem);
  const solutionSearch = countReflectionSolutions(problem, {
    searchStepLimit: REFLECTION_UNIQUENESS_SEARCH_STEP_LIMIT,
  });
  if (solutionSearch.status === "search-limit-reached") {
    return { status: "invalid", reason: "search-limit-reached", scale };
  }
  if (solutionSearch.solutionCount !== 1) {
    return {
      status: "invalid",
      reason:
        solutionSearch.solutionCount === 0
          ? "no-solution"
          : "multiple-solutions",
      scale,
    };
  }

  const trace = traceReflectionHumanSolve(problem, {
    // 解は推論の手掛かりには使わず、仮定の試しを省く高速化（結果は変わらない）にだけ渡す。
    knownSolution: problem.solution,
    ...options,
  });
  if (trace.status !== "solved" || trace.highestLevel === null) {
    return {
      status: "unsupported",
      reason:
        trace.status === "assumption-limit-reached"
          ? "assumption-limit-reached"
          : "unresolved",
      scale,
      unresolvedCellCount: trace.unresolvedCellCount,
    };
  }
  return {
    status: "analyzed",
    scale,
    features: {
      highestLevel: trace.highestLevel,
      fixedPieceCountByLevel: trace.fixedPieceCountByLevel,
      propagationRoundCount: trace.propagationRoundCount,
      assumptionTestCount: trace.assumptionTestCount,
      assumptionEliminationCount: trace.assumptionEliminationCount,
    },
    trial: measureTrialFeatures(problem),
  };
}
