import {
  analyzeHamiltonianPathDrawingBranches,
  type HamiltonianPathDrawingBranches,
} from "@/games/hamiltonian-path/problem/generation/drawing-branches";
import {
  type HamiltonianPathHumanSolveOptions,
  type HamiltonianPathReasoningStage,
  traceHamiltonianPathHumanSolve,
} from "@/games/hamiltonian-path/problem/generation/human-solver";
import { countHamiltonianPathSolutions } from "@/games/hamiltonian-path/problem/generation/solver";
import type { HamiltonianPathProblem } from "@/games/hamiltonian-path/problem/problem";
import { listHamiltonianPathOpenCells } from "@/games/hamiltonian-path/puzzle/board";

/**
 * 難易度特徴と比べるための問題の規模。挑戦ではなく、なぞる長さと盤面の広さの側の値。
 * - `openCellCount`: 道が通るマスの数（なぞる長さ）。
 */
export type HamiltonianPathScaleMetrics = {
  size: number;
  cellCount: number;
  openCellCount: number;
  wallCount: number;
  partitionCount: number;
};

/**
 * 人間向け解法器（段階1〜6）で、始点と盤面だけから道を決め切った経過から求めた特徴。
 * - `localReasoningSuffices`: 局所の推論（段階1〜2）だけで道が決まり、一度も止まらなかった。
 * - `regionalReasoningUsed`: 分断・到達・パリティの推論（段階3〜4）で、仮置きの外の盤面を進めたことがある。
 * - `assumptionCount`: 段階1〜4で止まり、1段仮置きで辺を1本決めた回数（先読みを要した回数）。
 * - `deepAssumptionCount`: 2段仮置きで辺を1本決めた回数。
 * - `longestRefutationLength`: 仮置きから矛盾が出るまでの推論の手数の最大（最も長い先読み）。仮置きが無ければ0。
 * - `refutationLengths`: 仮置きで辺を決めた回ごとの、矛盾までの推論の手数。
 * - `stallCount`: 段階1〜2だけでは進めなくなった回数。
 * - `firstStallDecidedEdgeRatio`: 最初に止まった時点で、使う・使わないが決まっていた辺の割合。強制の連鎖でどこまで進むか。
 * - `firingCountByStage`: 仮置きの外で各段階の推論を使った回数。添字0が段階1。
 */
export type HamiltonianPathReasoningFeatures = {
  localReasoningSuffices: boolean;
  regionalReasoningUsed: boolean;
  assumptionCount: number;
  deepAssumptionCount: number;
  longestRefutationLength: number;
  refutationLengths: readonly number[];
  stallCount: number;
  firstStallDecidedEdgeRatio: number;
  firingCountByStage: Readonly<Record<HamiltonianPathReasoningStage, number>>;
};

/**
 * - `analyzed`: 一意解で、段階1〜6の推論で道を決め切れた。`drawing` は始点から解の道を引き進める視点の分岐（診断と提供範囲の判断に使う）。
 * - `unsupported`: 一意解だが、2段仮置きまで使っても決まらない辺が残る（`unresolved`）、または推論の作業量の上限に達した
 *   （`computation-limit`）。評価不能。
 * - `invalid`: 解が無い、2つ以上ある、または一意性を確かめる探索が上限に達した。
 */
export type HamiltonianPathDifficultyAnalysis =
  | {
      status: "analyzed";
      scale: HamiltonianPathScaleMetrics;
      reasoning: HamiltonianPathReasoningFeatures;
      drawing: HamiltonianPathDrawingBranches;
    }
  | {
      status: "unsupported";
      reason: "unresolved" | "computation-limit";
      scale: HamiltonianPathScaleMetrics;
    }
  | {
      status: "invalid";
      reason: "no-solution" | "multiple-solutions" | "search-limit-reached";
      scale: HamiltonianPathScaleMetrics;
    };

/**
 * 分析で一意性を確かめる探索の節点数の上限。生成器（20,000）より大きくとり、生成器が一意と確かめた問題を
 * 上限で退けないようにする。研究用 Python が分析前の最終確認に使った値（`node_limit * 5`）と同じ。
 */
const UNIQUENESS_SEARCH_STEP_LIMIT = 100_000;

function measureScale(
  problem: HamiltonianPathProblem,
): HamiltonianPathScaleMetrics {
  return {
    size: problem.size,
    cellCount: problem.size * problem.size,
    openCellCount: listHamiltonianPathOpenCells(problem).length,
    wallCount: problem.walls.length,
    partitionCount: problem.partitions.length,
  };
}

/**
 * 一意性を確かめたうえで、人間向け解法器の経過を特徴へまとめ、解の道を引き進める視点の分岐も測る。
 * 解の道は分析の中で一意性の探索から求め直し、問題からは受け取らない。
 */
export function analyzeHamiltonianPathDifficulty(
  problem: HamiltonianPathProblem,
  options: HamiltonianPathHumanSolveOptions = {},
): HamiltonianPathDifficultyAnalysis {
  const scale = measureScale(problem);
  const solutionSearch = countHamiltonianPathSolutions(problem, {
    searchStepLimit: UNIQUENESS_SEARCH_STEP_LIMIT,
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

  const trace = traceHamiltonianPathHumanSolve(problem, options);
  if (trace.status === "contradiction") {
    throw new Error(
      "Human solver found a contradiction in a uniquely solvable Hamiltonian path problem",
    );
  }
  if (trace.status !== "solved") {
    return {
      status: "unsupported",
      reason:
        trace.status === "unresolved" ? "unresolved" : "computation-limit",
      scale,
    };
  }
  const drawing = analyzeHamiltonianPathDrawingBranches(
    problem,
    solutionSearch.firstSolutions[0]!,
    options,
  );
  if (drawing === "work-limit-reached") {
    return { status: "unsupported", reason: "computation-limit", scale };
  }
  const [local, loop, region, parity, single, deep] = trace.firingCountByStage;
  return {
    status: "analyzed",
    scale,
    reasoning: {
      localReasoningSuffices: trace.stallCount === 0,
      regionalReasoningUsed: region + parity > 0,
      assumptionCount: trace.assumptionCount,
      deepAssumptionCount: trace.deepAssumptionCount,
      longestRefutationLength: Math.max(0, ...trace.refutationLengths),
      refutationLengths: trace.refutationLengths,
      stallCount: trace.stallCount,
      firstStallDecidedEdgeRatio: trace.firstStallDecidedEdgeRatio,
      firingCountByStage: {
        1: local,
        2: loop,
        3: region,
        4: parity,
        5: single,
        6: deep,
      },
    },
    drawing,
  };
}
