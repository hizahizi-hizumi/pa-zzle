import {
  areAllBridgeComponentsJoined,
  type BridgeBounds,
  BridgesContradiction,
  type BridgesSolverContext,
  copyBridgeBounds,
  createBridgesSolverContext,
  createInitialBridgeBounds,
} from "@/games/bridges/problem/generation/bridge-bounds";
import { propagateBridgesCountReasoning } from "@/games/bridges/problem/generation/human-solver";
import type { BridgesBoard } from "@/games/bridges/puzzle/board";
import {
  type ProblemRandom,
  pickProblemValue,
  shuffleProblemValues,
} from "@/games/problem-seed";

/**
 * 試す辺の選び方。
 * - `random`: 未決の辺から無作為に選ぶ（素朴な試し置き）。
 * - `most-constrained`: 未決の行き先が最も少ない島のまわりから選ぶ（慣れた試し置き）。
 */
export type BridgesTrialEdgeChoice = "random" | "most-constrained";

/**
 * - `solved`: 解けた。
 * - `backtrackCount`: 戻した回数。本数が破れたときと、全島がちょうどなのにつながっていないときに戻す。
 * - `disconnectedFullCount`: 全島の本数がちょうどになったのに、つながっていなかった回数。盤面では全島が灰色なのにクリアにならない。
 * - `exceededNodeLimit`: 試した局面の数が上限を超えて打ち切った。
 */
export type BridgesNaiveTrialResult = {
  solved: boolean;
  backtrackCount: number;
  disconnectedFullCount: number;
  exceededNodeLimit: boolean;
};

/** 1回の試行で試す局面の数の上限。人の能力ではなく、計算を打ち切るための上限。 */
const NAIVE_TRIAL_NODE_LIMIT = 20_000;

function countUndecidedEdges(
  { network }: BridgesSolverContext,
  { lower, upper }: BridgeBounds,
  island: number,
): number {
  return network.islandEdges[island]!.filter(
    (edge) => lower[edge]! < upper[edge]!,
  ).length;
}

function chooseTrialEdge(
  context: BridgesSolverContext,
  bounds: BridgeBounds,
  undecided: readonly number[],
  choice: BridgesTrialEdgeChoice,
  random: ProblemRandom,
): number {
  if (choice === "random") {
    return pickProblemValue(undecided, random);
  }
  function slackOf(edge: number): number {
    const [from, to] = context.endpoints[edge]!;
    return Math.min(
      countUndecidedEdges(context, bounds, from),
      countUndecidedEdges(context, bounds, to),
    );
  }
  const tightest = Math.min(...undecided.map(slackOf));
  return pickProblemValue(
    undecided.filter((edge) => slackOf(edge) === tightest),
    random,
  );
}

/**
 * 素朴な解き方（試し置き）。盤面が見せる島ごとの本数の知らせのもとで、数字の読み（A1・A2）で進め、
 * 止まったら未決の辺を選んで本数を無作為に仮に決める。本数が破れたら戻し、全島がちょうどなのにつながっていなければ戻す。
 * 交差する橋は置けないので、交わる辺に架かった橋のある辺には架けない。
 * 止める向きにだけ使う。解けないことや戻しが多いことは、熟練者に難しいことの根拠にならない。
 */
export function tryBridgesNaively(
  board: BridgesBoard,
  random: ProblemRandom,
  choice: BridgesTrialEdgeChoice = "random",
): BridgesNaiveTrialResult {
  const context = createBridgesSolverContext(board);
  let backtrackCount = 0;
  let disconnectedFullCount = 0;
  let nodeCount = 0;

  function search(bounds: BridgeBounds): boolean {
    nodeCount += 1;
    if (nodeCount > NAIVE_TRIAL_NODE_LIMIT) {
      return false;
    }
    try {
      propagateBridgesCountReasoning(context, bounds);
    } catch (error) {
      if (!(error instanceof BridgesContradiction)) {
        throw error;
      }
      backtrackCount += 1;
      return false;
    }
    const undecided = [...bounds.lower.keys()].filter(
      (edge) => bounds.lower[edge]! < bounds.upper[edge]!,
    );
    if (undecided.length === 0) {
      if (areAllBridgeComponentsJoined(context, bounds.lower)) {
        return true;
      }
      disconnectedFullCount += 1;
      backtrackCount += 1;
      return false;
    }
    const edge = chooseTrialEdge(context, bounds, undecided, choice, random);
    const counts = shuffleProblemValues(
      Array.from(
        { length: bounds.upper[edge]! - bounds.lower[edge]! + 1 },
        (_, offset) => bounds.lower[edge]! + offset,
      ),
      random,
    );
    for (const count of counts) {
      const branch = copyBridgeBounds(bounds);
      branch.lower[edge] = count;
      branch.upper[edge] = count;
      if (search(branch)) {
        return true;
      }
      if (nodeCount > NAIVE_TRIAL_NODE_LIMIT) {
        return false;
      }
    }
    return false;
  }

  const solved = search(createInitialBridgeBounds(context));
  return {
    solved,
    backtrackCount,
    disconnectedFullCount,
    exceededNodeLimit: nodeCount > NAIVE_TRIAL_NODE_LIMIT,
  };
}
