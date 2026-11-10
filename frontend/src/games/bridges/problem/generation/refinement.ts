import { countBridgesSolutions } from "@/games/bridges/problem/generation/exact-solver";
import {
  BRIDGES_SHARP_ROUND_EDGE_LIMIT,
  traceBridgesHumanSolve,
} from "@/games/bridges/problem/generation/human-solver";
import type { BridgesCompletedLayout } from "@/games/bridges/problem/generation/island-spread";
import {
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import type { ProblemRandom } from "@/games/problem-seed";

/** 磨く途中で一意性を確かめる探索の局面の数の上限。上限に届いた盤面は一意と分からないので採らない。 */
const REFINEMENT_UNIQUENESS_NODE_LIMIT = 100_000;

/**
 * 磨くときに保つ数字の平均の下限。読みの量だけを上げると、数字が 1 と 2 に寄って「1 と 2 ばかりの木」に戻るので、
 * 手作りの良問の平均（3 前後）に近い所に下限を置き、下回る変形を読みの量と引き換えに割り引く。
 */
const MINIMUM_CLUE_MEAN = 2.8;

/** 磨くときに保つ、架ける組のうち2本の組の割合の下限。手作りの良問は3〜5割。 */
const MINIMUM_DOUBLE_BRIDGE_RATIO = 0.3;

/** 下限を下回った分を、読みの量の何点ぶんとして割り引くか。下限を保つ変形を、読みの量が少し下がっても選ぶ強さ。 */
const QUALITY_SHORTFALL_WEIGHT = 10;

type RefinementScore = { value: number };

function countClues(
  board: BridgesBoard,
  solution: readonly number[],
): number[] {
  const { edges } = getBridgesNetwork(board);
  const clues = board.islands.map(() => 0);
  for (const [edge, { from, to }] of edges.entries()) {
    clues[from]! += solution[edge]!;
    clues[to]! += solution[edge]!;
  }
  return clues;
}

function withClues(
  board: BridgesBoard,
  solution: readonly number[],
): BridgesBoard {
  const clues = countClues(board, solution);
  return {
    ...board,
    islands: board.islands.map((island, index) => ({
      ...island,
      clue: clues[index]!,
    })),
  };
}

function isConnected(
  board: BridgesBoard,
  solution: readonly number[],
): boolean {
  const { edges } = getBridgesNetwork(board);
  const parents = board.islands.map((_, island) => island);
  function find(island: number): number {
    while (parents[island] !== island) {
      island = parents[island]!;
    }
    return island;
  }
  for (const [edge, { from, to }] of edges.entries()) {
    if (solution[edge]! > 0) {
      parents[find(from)] = find(to);
    }
  }
  const root = find(0);
  return board.islands.every((_, island) => find(island) === root);
}

/**
 * 盤面を、人が読む量で点にする。一意解で、1手の先読みまでの推理で解き切れる盤面だけに点を付け、ほかは `null`。
 * 点は、数字の読みで止まった回数に、つながりの読みの手詰まりを足す。1〜2組だけが決まる手詰まり（一か所の気づき）は
 * 3点、多くの組がまとめて決まる手詰まり（同じ規則で盤面を掃く作業）は1点にし、唯一の通り道は3点、1手の先読みは8点を足す。
 * 1手の先読みを最も重くするのは、レベル5 が求める2回以上の先読みが要る盤面へ寄せるため。
 * 数字の平均と2本の割合が下限を下回った分は割り引く。
 */
function scoreLayout(
  board: BridgesBoard,
  solution: readonly number[],
): RefinementScore | null {
  const count = countBridgesSolutions(board, {
    limit: 2,
    nodeLimit: REFINEMENT_UNIQUENESS_NODE_LIMIT,
  });
  if (count.exceededNodeLimit || count.solutionCount !== 1) {
    return null;
  }
  const trace = traceBridgesHumanSolve(board, "D");
  if (trace.status !== "solved") {
    return null;
  }
  let value = 0;
  for (const { tier, edgeCount } of trace.rounds) {
    if (tier === "A2") {
      value += 1;
    } else if (tier !== "A1") {
      value += edgeCount <= BRIDGES_SHARP_ROUND_EDGE_LIMIT ? 3 : 1;
      value += tier === "D" ? 8 : tier === "C3" ? 3 : 0;
    }
  }
  const clues = board.islands.map(({ clue }) => clue);
  const clueMean =
    clues.reduce((total, clue) => total + clue, 0) / clues.length;
  const used = solution.filter((bridges) => bridges > 0).length;
  const doubleRatio =
    solution.filter((bridges) => bridges === 2).length / Math.max(1, used);
  const shortfall =
    Math.max(0, MINIMUM_CLUE_MEAN - clueMean) +
    Math.max(0, MINIMUM_DOUBLE_BRIDGE_RATIO - doubleRatio);
  return { value: value - QUALITY_SHORTFALL_WEIGHT * shortfall };
}

/** 辺1つの本数を1段だけ変えた解。交わる橋が架かっている辺には新しく架けない。 */
function mutate(
  board: BridgesBoard,
  solution: readonly number[],
  random: ProblemRandom,
): number[] | null {
  const { edges, crossingEdges } = getBridgesNetwork(board);
  const edge = Math.floor(random() * edges.length);
  const current = solution[edge]!;
  const choice = random();
  if (current === 0) {
    return crossingEdges[edge]!.some((crossing) => solution[crossing]! > 0)
      ? null
      : solution.with(edge, 1);
  }
  if (current === 1) {
    return solution.with(edge, choice < 0.5 ? 2 : 0);
  }
  return solution.with(edge, choice < 0.7 ? 1 : 0);
}

/**
 * 島の位置を変えずに、解の橋を1本ずつ変えて、人が読む量の多い盤面へ磨く（山登り）。`steps` 回、辺1つの本数を1段変えた解を作り、
 * 全島がつながったまま、一意解で推理だけで解け、点が下がらなければ採る。初めの解が一意でなければ、一意になる変形を先に採る。
 * 島の位置・候補の辺は変えないので、盤面の形の性質（外周・橋の長さ・島の数）は広げたときのまま。
 * 磨き終えた解が一意でなければ `null`。
 */
export function refineBridgesLayout(
  layout: BridgesCompletedLayout,
  steps: number,
  random: ProblemRandom,
): BridgesCompletedLayout | null {
  let board = layout.board;
  let solution = [...layout.solution];
  let score = scoreLayout(board, solution);
  for (let step = 0; step < steps; step += 1) {
    const next = mutate(board, solution, random);
    if (next === null || !isConnected(board, next)) {
      continue;
    }
    const nextBoard = withClues(board, next);
    const nextScore = scoreLayout(nextBoard, next);
    if (
      nextScore !== null &&
      (score === null || nextScore.value >= score.value)
    ) {
      board = nextBoard;
      solution = next;
      score = nextScore;
    }
  }
  return score === null ? null : { board, solution };
}
