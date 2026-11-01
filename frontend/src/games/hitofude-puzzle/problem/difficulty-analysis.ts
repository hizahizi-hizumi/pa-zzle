import {
  analyzeHitofudePuzzleDrawingBranches,
  type HitofudePuzzleDrawingBranches,
} from "@/games/hitofude-puzzle/problem/generation/drawing-branches";
import {
  type HitofudePuzzleHumanSolveOptions,
  type HitofudePuzzleHumanSolveTrace,
  type HitofudePuzzleReasoningStage,
  traceHitofudePuzzleHumanSolve,
} from "@/games/hitofude-puzzle/problem/generation/human-solver";
import {
  countHitofudePuzzleSolutions,
  type HitofudePuzzleSolutionSearchResult,
} from "@/games/hitofude-puzzle/problem/generation/solver";
import {
  type HitofudePuzzleBoardOrientation,
  listHitofudePuzzleBoardOrientations,
} from "@/games/hitofude-puzzle/problem/generation/symmetry";
import type {
  HitofudePuzzleProblem,
  HitofudePuzzleSolveWorkload,
} from "@/games/hitofude-puzzle/problem/problem";
import { listHitofudePuzzleOpenCells } from "@/games/hitofude-puzzle/puzzle/board";

/**
 * 難易度特徴と比べるための問題の規模。挑戦ではなく、なぞる長さと盤面の広さの側の値。
 * - `size`・`cellCount`: 穴を含む枠の一辺とマスの数。
 * - `openCellCount`: 道が通るマスの数（なぞる長さ）。
 * - `holeCount`: 穴の数。
 */
export type HitofudePuzzleScaleMetrics = {
  size: number;
  cellCount: number;
  openCellCount: number;
  holeCount: number;
};

/**
 * 人間向け解法器（段階1〜6）で、始点と盤面だけから道を決め切った経過から求めた特徴。回転・反転した8通りの盤面のうち、
 * 最も上手に読めた向きの経過（`analyzeHitofudePuzzleDifficulty`）で、盤面の向きに依らない。
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
export type HitofudePuzzleReasoningFeatures = {
  localReasoningSuffices: boolean;
  regionalReasoningUsed: boolean;
  assumptionCount: number;
  deepAssumptionCount: number;
  longestRefutationLength: number;
  refutationLengths: readonly number[];
  stallCount: number;
  firstStallDecidedEdgeRatio: number;
  firingCountByStage: Readonly<Record<HitofudePuzzleReasoningStage, number>>;
};

/**
 * - `analyzed`: 一意解で、段階1〜6の推論で道を決め切れた。`drawing` は始点から解の道を引き進める視点の分岐（診断と提供範囲の判断に使う）。
 * - `unsupported`: 一意解だが、2段仮置きまで使っても決まらない辺が残る（`unresolved`）、または推論の作業量の上限に達した
 *   （`computation-limit`）。評価不能。
 * - `invalid`: 解が無い、2つ以上ある、または一意性を確かめる探索が上限に達した。
 */
export type HitofudePuzzleDifficultyAnalysis =
  | {
      status: "analyzed";
      scale: HitofudePuzzleScaleMetrics;
      reasoning: HitofudePuzzleReasoningFeatures;
      drawing: HitofudePuzzleDrawingBranches;
    }
  | {
      status: "unsupported";
      reason: "unresolved" | "computation-limit";
      scale: HitofudePuzzleScaleMetrics;
    }
  | {
      status: "invalid";
      reason: "no-solution" | "multiple-solutions" | "search-limit-reached";
      scale: HitofudePuzzleScaleMetrics;
    };

export type HitofudePuzzleAnalyzedDifficulty = Extract<
  HitofudePuzzleDifficultyAnalysis,
  { status: "analyzed" }
>;

/**
 * 分析で一意性を確かめる探索の節点数の上限。生成器（20,000）より大きくとり、生成器が一意と確かめた問題を
 * 上限で退けないようにする。研究用 Python が分析前の最終確認に使った値（`node_limit * 5`）と同じ。
 */
const UNIQUENESS_SEARCH_STEP_LIMIT = 100_000;

/**
 * 分析の前に、解を2つまで数えて一意性を確かめる。内部診断が分析と同じ探索の結果を見せられるよう、
 * 分析とは別に呼べるようにしている。
 */
export function searchHitofudePuzzleSolutionsForAnalysis(
  problem: HitofudePuzzleProblem,
): HitofudePuzzleSolutionSearchResult {
  return countHitofudePuzzleSolutions(problem, {
    searchStepLimit: UNIQUENESS_SEARCH_STEP_LIMIT,
  });
}

function measureScale(
  problem: HitofudePuzzleProblem,
): HitofudePuzzleScaleMetrics {
  return {
    size: problem.size,
    cellCount: problem.size * problem.size,
    openCellCount: listHitofudePuzzleOpenCells(problem).length,
    holeCount: problem.holes.length,
  };
}

function summarizeReasoning(
  trace: HitofudePuzzleHumanSolveTrace,
): HitofudePuzzleReasoningFeatures {
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
}: HitofudePuzzleReasoningFeatures): number {
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
  left: HitofudePuzzleReasoningFeatures,
  right: HitofudePuzzleReasoningFeatures,
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
  orientation: HitofudePuzzleBoardOrientation;
  reasoning: HitofudePuzzleReasoningFeatures;
};

/**
 * 回転・反転した8通りの盤面のそれぞれで、人間向け解法器が道を決め切った読み方。解き切れた向きが無ければ、
 * 評価不能の理由を返す。どの向きでも解法器は同じ推論を使うが、仮置きを試す辺の順がマスの番号に従うので、
 * 盤面の向きによって仮置きの回数や先読みの手数が変わる。
 */
function readInEveryOrientation(
  problem: HitofudePuzzleProblem,
  options: HitofudePuzzleHumanSolveOptions,
): OrientedReasoning[] | "unresolved" | "computation-limit" {
  const traces = listHitofudePuzzleBoardOrientations(problem).map(
    (orientation) => ({
      orientation,
      trace: traceHitofudePuzzleHumanSolve(orientation.board, options),
    }),
  );
  if (traces.some(({ trace }) => trace.status === "contradiction")) {
    throw new Error(
      "Human solver found a contradiction in a uniquely solvable Hitofude puzzle problem",
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
 * 解の道は一意性の探索（`searchHitofudePuzzleSolutionsForAnalysis`）から求め、問題からは受け取らない。
 * 探索を済ませた呼び出し元は、その結果を `solutionSearch` に渡す。
 *
 * 推論の特徴は、回転・反転した8通りの盤面のうち最も上手に読めた向きの読み方から求める（`compareReasoning`）。
 * 盤面の向きで難易度が変わらないようにするためで、「最も上手な読み順でも、少なくともこれだけ先読みが要る」を表す。
 * 描画視点の分岐は、その読み方になった向きの盤面で測る。
 */
export function analyzeHitofudePuzzleDifficulty(
  problem: HitofudePuzzleProblem,
  options: HitofudePuzzleHumanSolveOptions = {},
  solutionSearch = searchHitofudePuzzleSolutionsForAnalysis(problem),
): HitofudePuzzleDifficultyAnalysis {
  const scale = measureScale(problem);
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
      analyzeHitofudePuzzleDrawingBranches(
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
export function getHitofudePuzzleSolveWorkload({
  scale,
  reasoning,
  drawing,
}: HitofudePuzzleAnalyzedDifficulty): HitofudePuzzleSolveWorkload {
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
