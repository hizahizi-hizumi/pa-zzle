import {
  BRIDGES_SHARP_ROUND_EDGE_LIMIT,
  type BridgesReasoningRound,
  traceBridgesHumanSolve,
} from "@/games/bridges/problem/generation/human-solver";
import type { BridgesCompletedLayout } from "@/games/bridges/problem/generation/island-spread";
import type { BridgesRefinementGoal } from "@/games/bridges/problem/problem";
import {
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import type { ProblemRandom } from "@/games/problem-seed";

/**
 * 磨くときに保つ数字の平均の下限。読みの量だけを上げると、数字が 1 と 2 に寄って「1 と 2 ばかりの木」に戻るので、
 * 手作りの良問の平均（3 前後）に近い所に下限を置き、下回る変形を読みの量と引き換えに割り引く。
 */
const MINIMUM_CLUE_MEAN = 2.8;

/** 磨くときに保つ、架ける組のうち2本の組の割合の下限。手作りの良問は3〜5割。 */
const MINIMUM_DOUBLE_BRIDGE_RATIO = 0.3;

/** 磨くときに保つ、数字2の島の割合の上限。2 ばかりの盤面は「足りる・足りない」の確かめが続く。 */
const MAXIMUM_TWO_CLUE_SHARE = 0.3;

/** 磨くときに保つ、最も多い数字の島の割合の上限。 */
const MAXIMUM_DOMINANT_CLUE_SHARE = 0.35;

/** 磨くときに保つ、架ける組のうち盤面の外周に沿う組の割合の上限。 */
const MAXIMUM_BORDER_BRIDGE_SHARE = 0.5;

/** 下限・上限を外れた分を、読みの量の何点ぶんとして割り引くか。外れない変形を、読みの量が少し下がっても選ぶ強さ。 */
const QUALITY_SHORTFALL_WEIGHT = 30;

/** 点に数える交差で塞がった行き先と、解の輪の数の上限。それより多くは、読みの量を上げずに数だけを増やす変形になる。 */
const MAXIMUM_SCORED_CROSSING_BLOCKS = 6;
const MAXIMUM_SCORED_LOOPS = 3;

/** 1手の先読みが続けて要ったとみなす、前の1手の先読みからほかの読みで狭めた組の数の上限。分析と同じ値。 */
const LOOKAHEAD_CHAIN_GAP = 3;

/**
 * 焼きなましの温度の始めと終わり（点の差の尺度）。始めは数点下がる変形も時々採って山登りの行き止まりを抜け、
 * 終わりはほぼ下がる変形を採らない。磨き終えたら、途中で最も点の高かった盤面を返す。
 */
const INITIAL_TEMPERATURE = 4;
const FINAL_TEMPERATURE = 0.2;

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
 * 手詰まりの読みを、磨く向き（`goal`）に応じて点にする。1〜2組だけが決まる手詰まり（一か所の気づき）を、多くの組がまとめて決まる
 * 手詰まり（同じ規則で盤面を掃く作業）より重くする。
 * - `count`: 配分の読み（A2）2点、2島を閉じない読みの一か所の気づき2点。ほかのつながりの読みは −6点、1手の先読みは −12点。
 * - `closure`: 配分の読み1点、つながりの読みの一か所の気づき3点（掃く手詰まり1点）、唯一の通り道はさらに4点。1手の先読みは −12点。
 * - `lookahead`: `closure` の点に、1手の先読み8点、組が閉じるか孤立するのを見る先読みはさらに4点、前の先読みから続けて要る
 *   先読みはさらに6点を足す。
 */
function scoreRounds(
  rounds: readonly BridgesReasoningRound[],
  goal: BridgesRefinementGoal,
): number {
  let value = 0;
  let sinceLookahead: number | null = null;
  for (const { tier, edgeCount, readsGroup } of rounds) {
    const sharp = edgeCount <= BRIDGES_SHARP_ROUND_EDGE_LIMIT;
    if (goal === "count") {
      value +=
        tier === "A2"
          ? 2
          : tier === "C1p"
            ? sharp
              ? 2
              : 0
            : tier === "D"
              ? -12
              : tier === "A1"
                ? 0
                : -6;
      continue;
    }
    if (tier === "A2") {
      value += 1;
    } else if (tier === "D" && goal === "closure") {
      value -= 12;
    } else if (tier !== "A1") {
      value += sharp ? 3 : 1;
      value += tier === "D" ? 8 : tier === "C3" ? 4 : 0;
    }
    if (tier === "D") {
      value += readsGroup ? 4 : 0;
      value +=
        sinceLookahead !== null && sinceLookahead <= LOOKAHEAD_CHAIN_GAP
          ? 6
          : 0;
      sinceLookahead = 0;
    } else if (sinceLookahead !== null) {
      sinceLookahead += edgeCount;
    }
  }
  return value;
}

/**
 * 盤面を、人が読む量で点にする。1手の先読みまでの推理で解き切れる盤面だけに点を付け、ほかは `null`。
 * 推理の段はどれも盤面から必ず言えることだけを決めるので、推理で全辺が決まり全島がつながれば解はそれだけで、一意解になる。
 * 手詰まりの読みを磨く向きに応じて点にし（`scoreRounds`）、交差で塞がった行き先と解の輪は1つ1点（上限あり）、
 * 6以上の数字と7以上の数字があればそれぞれ2点を足す。
 * 数字の平均・2本の割合・数字2の割合・最も多い数字の割合・外周に沿う橋の割合が下限・上限を外れた分は割り引く。
 */
function scoreLayout(
  board: BridgesBoard,
  solution: readonly number[],
  goal: BridgesRefinementGoal,
): RefinementScore | null {
  const trace = traceBridgesHumanSolve(board, "D");
  if (trace.status !== "solved") {
    return null;
  }
  let value = scoreRounds(trace.rounds, goal);
  value += Math.min(trace.crossingBlockCount, MAXIMUM_SCORED_CROSSING_BLOCKS);
  const clues = board.islands.map(({ clue }) => clue);
  const used = solution.filter((bridges) => bridges > 0).length;
  value += Math.min(
    MAXIMUM_SCORED_LOOPS,
    Math.max(0, used - board.islands.length + 1),
  );
  value += clues.some((clue) => clue >= 6) ? 2 : 0;
  value += clues.some((clue) => clue >= 7) ? 2 : 0;
  const clueMean =
    clues.reduce((total, clue) => total + clue, 0) / clues.length;
  const doubleRatio =
    solution.filter((bridges) => bridges === 2).length / Math.max(1, used);
  const clueCounts = new Map<number, number>();
  for (const clue of clues) {
    clueCounts.set(clue, (clueCounts.get(clue) ?? 0) + 1);
  }
  const twoShare = (clueCounts.get(2) ?? 0) / clues.length;
  const dominantShare = Math.max(...clueCounts.values()) / clues.length;
  const { edges } = getBridgesNetwork(board);
  const last = board.width - 1;
  const borderShare =
    edges.filter(({ from, to }, edge) => {
      if (solution[edge] === 0) {
        return false;
      }
      const start = board.islands[from]!;
      const end = board.islands[to]!;
      return (
        (start.row === end.row && (start.row === 0 || start.row === last)) ||
        (start.column === end.column &&
          (start.column === 0 || start.column === last))
      );
    }).length / Math.max(1, used);
  const shortfall =
    Math.max(0, borderShare - MAXIMUM_BORDER_BRIDGE_SHARE) +
    Math.max(0, MINIMUM_CLUE_MEAN - clueMean) +
    Math.max(0, MINIMUM_DOUBLE_BRIDGE_RATIO - doubleRatio) +
    Math.max(0, twoShare - MAXIMUM_TWO_CLUE_SHARE) +
    Math.max(0, dominantShare - MAXIMUM_DOMINANT_CLUE_SHARE);
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
  goal: BridgesRefinementGoal,
  random: ProblemRandom,
): BridgesCompletedLayout | null {
  let board = layout.board;
  let solution = [...layout.solution];
  let score = scoreLayout(board, solution, goal);
  let best = score === null ? null : { board, solution, score };
  for (let step = 0; step < steps; step += 1) {
    const next = mutate(board, solution, random);
    if (next === null || !isConnected(board, next)) {
      continue;
    }
    const nextBoard = withClues(board, next);
    const nextScore = scoreLayout(nextBoard, next, goal);
    if (nextScore === null) {
      continue;
    }
    const temperature =
      INITIAL_TEMPERATURE +
      ((FINAL_TEMPERATURE - INITIAL_TEMPERATURE) * step) / steps;
    if (
      score === null ||
      nextScore.value >= score.value ||
      random() < Math.exp((nextScore.value - score.value) / temperature)
    ) {
      board = nextBoard;
      solution = next;
      score = nextScore;
      if (best === null || score.value > best.score.value) {
        best = { board, solution, score };
      }
    }
  }
  return best === null ? null : { board: best.board, solution: best.solution };
}
