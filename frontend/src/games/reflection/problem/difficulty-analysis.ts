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

/**
 * 難易度特徴と比べるための問題の規模。挑戦ではなく、読む範囲・置く対象の数の側の値。
 * - `clueCount`: 外周ヒントの本数（4 × 一辺）。
 * - `pieceKindCount`: 手持ちに含まれるピースの種類の数。
 */
export type ReflectionScaleMetrics = {
  size: number;
  cellCount: number;
  clueCount: number;
  pieceCount: number;
  pieceKindCount: number;
};

/**
 * 人間向け解法器で置き場所を決め切った経過から求めた特徴。
 * - `highestLevel`: 使わざるを得なかった最も深い推論レベル。
 * - `fixedPieceCountByLevel`: 各レベルの推論で新しく置き場所が決まったピースの数。添字0がレベル1。
 * - `propagationRoundCount`: 直接整合性・在庫の適用で候補が変わった回数。
 * - `assumptionTestCount` / `assumptionEliminationCount`: 仮に置いて確かめた回数と、矛盾で除いた候補の数。
 */
export type ReflectionReasoningFeatures = {
  highestLevel: ReflectionReasoningLevel;
  fixedPieceCountByLevel: readonly [number, number, number, number, number];
  propagationRoundCount: number;
  assumptionTestCount: number;
  assumptionEliminationCount: number;
};

/**
 * 一致表示を見ながら、推論をせずに外周ヒントを1本ずつ満たしていく試し置き（`traceReflectionTrialSolve`）の経過から求めた特徴。
 * 一致表示があると各外周ヒントの正否がすぐ分かるので、ヒント同士が干渉しない問題は試し置きだけで押し切れる。
 * - `solved`: 試し置きで、手数の上限までに解き切れた。
 * - `moveCount`: 解き切るまで（または止まるまで）の手数。
 * - `retryCount`: 一致していた外周ヒントを崩したり、別の置き方を試したりした手の数。1つ直すと他が崩れる干渉の強さの目安。
 */
export type ReflectionTrialFeatures = {
  solved: boolean;
  moveCount: number;
  retryCount: number;
};

/**
 * - `analyzed`: 一意解で、推論レベル1〜5で置き場所を決め切れた。
 * - `unsupported`: 一意解だが、推論レベル5まで使っても決まらないマスが残る（評価不能）。`reason` は
 *   `unresolved`（仮定を試し尽くしても決まらない）か `assumption-limit-reached`（仮定を試す回数の上限に達した）。
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

/**
 * 手持ちと外周ヒントの一意性を確かめたうえで、人間向け解法器の経過を特徴へまとめる。
 * 解は推論の手掛かりには使わず、仮定の試しを省く高速化（結果は変わらない）にだけ渡す。
 */
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
