import {
  analyzeHamiltonianPathDrawingBranches,
  type HamiltonianPathDrawingBranches,
} from "@/games/hamiltonian-path/problem/generation/drawing-branches";
import {
  type HamiltonianPathHumanSolveOptions,
  type HamiltonianPathHumanSolveTrace,
  type HamiltonianPathReasoningStage,
  traceHamiltonianPathHumanSolve,
} from "@/games/hamiltonian-path/problem/generation/human-solver";
import { countHamiltonianPathSolutions } from "@/games/hamiltonian-path/problem/generation/solver";
import {
  type HamiltonianPathBoardOrientation,
  listHamiltonianPathBoardOrientations,
} from "@/games/hamiltonian-path/problem/generation/symmetry";
import type {
  HamiltonianPathProblem,
  HamiltonianPathSolveWorkload,
} from "@/games/hamiltonian-path/problem/problem";
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
 * 人間向け解法器（段階1〜6）で、始点と盤面だけから道を決め切った経過から求めた特徴。回転・反転した8通りの盤面のうち、
 * 最も上手に読めた向きの経過（`analyzeHamiltonianPathDifficulty`）で、盤面の向きに依らない。
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

export type HamiltonianPathAnalyzedDifficulty = Extract<
  HamiltonianPathDifficultyAnalysis,
  { status: "analyzed" }
>;

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

function summarizeReasoning(
  trace: HamiltonianPathHumanSolveTrace,
): HamiltonianPathReasoningFeatures {
  const [local, loop, region, parity, single, deep] = trace.firingCountByStage;
  return {
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
  };
}

function sumRefutationLengths({
  refutationLengths,
}: HamiltonianPathReasoningFeatures): number {
  return refutationLengths.reduce((sum, length) => sum + length, 0);
}

function compareSerialized(left: unknown, right: unknown): number {
  const leftText = JSON.stringify(left);
  const rightText = JSON.stringify(right);
  return leftText < rightText ? -1 : leftText > rightText ? 1 : 0;
}

/**
 * 読み方の上手さの順（上手な方が先）。2段仮置きの回数、仮置きの回数、先読みの手数の合計、最も長い先読みの順に少ない方を
 * 上手とする。それでも並ぶ読み方は特徴全体の表記の順で決め、どの向きの盤面から数えても同じ読み方を選ぶ。
 */
function compareReasoning(
  left: HamiltonianPathReasoningFeatures,
  right: HamiltonianPathReasoningFeatures,
): number {
  return (
    left.deepAssumptionCount - right.deepAssumptionCount ||
    left.assumptionCount - right.assumptionCount ||
    sumRefutationLengths(left) - sumRefutationLengths(right) ||
    left.longestRefutationLength - right.longestRefutationLength ||
    compareSerialized(left, right)
  );
}

type OrientedReasoning = {
  orientation: HamiltonianPathBoardOrientation;
  reasoning: HamiltonianPathReasoningFeatures;
};

/**
 * 回転・反転した8通りの盤面のそれぞれで、人間向け解法器が道を決め切った読み方。解き切れた向きが無ければ、
 * 評価不能の理由を返す。どの向きでも解法器は同じ推論を使うが、仮置きを試す辺の順がマスの番号に従うので、
 * 盤面の向きによって仮置きの回数や先読みの手数が変わる。
 */
function readInEveryOrientation(
  problem: HamiltonianPathProblem,
  options: HamiltonianPathHumanSolveOptions,
): OrientedReasoning[] | "unresolved" | "computation-limit" {
  const traces = listHamiltonianPathBoardOrientations(problem).map(
    (orientation) => ({
      orientation,
      trace: traceHamiltonianPathHumanSolve(orientation.board, options),
    }),
  );
  if (traces.some(({ trace }) => trace.status === "contradiction")) {
    throw new Error(
      "Human solver found a contradiction in a uniquely solvable Hamiltonian path problem",
    );
  }
  const readings = traces.flatMap(({ orientation, trace }) =>
    trace.status === "solved"
      ? [{ orientation, reasoning: summarizeReasoning(trace) }]
      : [],
  );
  if (readings.length > 0) {
    return readings;
  }
  return traces.some(({ trace }) => trace.status === "unresolved")
    ? "unresolved"
    : "computation-limit";
}

/**
 * 一意性を確かめたうえで、人間向け解法器の経過を特徴へまとめ、解の道を引き進める視点の分岐も測る。
 * 解の道は分析の中で一意性の探索から求め直し、問題からは受け取らない。
 *
 * 推論の特徴は、回転・反転した8通りの盤面のうち最も上手に読めた向きの読み方から求める（`compareReasoning`）。
 * 盤面の向きで難易度が変わらないようにするためで、「最も上手な読み順でも、少なくともこれだけ先読みが要る」を表す。
 * 描画視点の分岐は、その読み方になった向きの盤面で測る。
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

  const readings = readInEveryOrientation(problem, options);
  if (!Array.isArray(readings)) {
    return { status: "unsupported", reason: readings, scale };
  }
  const [best] = readings.toSorted((left, right) =>
    compareReasoning(left.reasoning, right.reasoning),
  ) as [OrientedReasoning];
  const solution = solutionSearch.firstSolutions[0]!;
  // 同じ読み方になる向きが複数あっても、描画視点の分岐は向きで変わりうるので、どの向きから数えても同じものを選ぶ。
  const drawings = readings
    .filter(
      ({ reasoning }) => compareReasoning(reasoning, best.reasoning) === 0,
    )
    .map(({ orientation }) =>
      analyzeHamiltonianPathDrawingBranches(
        orientation.board,
        solution.map(orientation.transformCell),
        options,
      ),
    )
    .filter((drawing) => drawing !== "work-limit-reached");
  const [drawing] = drawings.toSorted(compareSerialized);
  if (!drawing) {
    return { status: "unsupported", reason: "computation-limit", scale };
  }
  return { status: "analyzed", scale, reasoning: best.reasoning, drawing };
}

/** 分析結果から、速さの基準時間に使う作業の量を取り出す。 */
export function getHamiltonianPathSolveWorkload({
  scale,
  reasoning,
  drawing,
}: HamiltonianPathAnalyzedDifficulty): HamiltonianPathSolveWorkload {
  return {
    openCellCount: scale.openCellCount,
    assumptionCount: reasoning.assumptionCount,
    refutationStepCount: reasoning.refutationLengths.reduce(
      (sum, length) => sum + length,
      0,
    ),
    longestRefutationLength: reasoning.longestRefutationLength,
    fatalBranchCount: drawing.fatalBranchCount,
  };
}
