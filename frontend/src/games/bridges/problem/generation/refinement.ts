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
const QUALITY_SHORTFALL_WEIGHT = 60;

/** 点に数える交差で塞がった行き先と、解の輪の数の上限。それより多くは、読みの量を上げずに数だけを増やす変形になる。 */
const MAXIMUM_SCORED_CROSSING_BLOCKS = 6;
/** 点に数える解の輪の数は、島の数をこの数で割った数まで。島が多いほど輪も多くする。 */
const ISLANDS_PER_SCORED_LOOP = 6;

/** 解の輪1つの点。 */
const LOOP_SCORE = 2;

/** 点に数える長い橋（盤面の一辺の半分以上）の数の上限と、1本の点。 */
const MAXIMUM_SCORED_LONG_BRIDGES = 4;
const LONG_BRIDGE_SCORE = 0.5;

/** 磨くときに保つ、架ける組のうち間が1マスの短い橋の割合の上限。 */
const MAXIMUM_SHORT_BRIDGE_SHARE = 0.5;

/** 磨くときに保つ、行き先のうち橋を架ける組の割合の上限。架けない行き先が無いと、どこへ架けるかを選ぶ所が無い。 */
const MAXIMUM_USED_EDGE_SHARE = 0.85;

/** 磨く途中で最も高い点がこの回数のあいだ上がらなければ、磨くのを打ち切る。 */
const REFINEMENT_PATIENCE = 700;

/** 1手の先読みが続けて要ったとみなす、前の1手の先読みからほかの読みで狭めた組の数の上限。分析と同じ値。 */
const LOOKAHEAD_CHAIN_GAP = 3;

/**
 * 上のレベルが1つ以上を求める読み（本数が破れるのを見る先読み・続けて要る先読み）と、2つ以上を求める解の輪の、最初の分に足す点。
 * 2つ目からと同じ点では、多い読みを1種類だけ増やす変形が選ばれ、レベルが求める読みの揃わない盤面が残る。
 */
const FIRST_COUNT_LOOKAHEAD_SCORE = 12;
const FIRST_CHAINED_LOOKAHEAD_SCORE = 15;
const FIRST_LOOP_SCORE = 3;
const FIRST_SCORED_LOOPS = 2;

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
 * - `entry`: 最初の配分の読み1点、2つ目からの配分の読みは −4点、つながりの読みは −6点、1手の先読みは −12点。
 * - `count`: 配分の読み（A2）2点、2島を閉じない読みの一か所の気づき2点。ほかのつながりの読みは −6点、1手の先読みは −12点。
 * - `closure`: 配分の読み1点、つながりの読みの一か所の気づき3点（掃く手詰まり1点）、唯一の通り道はさらに4点。1手の先読みは −12点。
 * - `lookahead`: `closure` の点に、1手の先読み8点、組が閉じるか孤立するのを見る先読みはさらに4点、本数が破れるのを見る
 *   先読みはさらに3点（最初の1回は12点）、架けすぎを退けて上限を下げる先読みはさらに4点、前の先読みから続けて要る先読みは
 *   さらに6点（最初の1回は15点）を足す。
 */
function scoreRounds(
  rounds: readonly BridgesReasoningRound[],
  goal: BridgesRefinementGoal,
): number {
  let value = 0;
  let countRounds = 0;
  let sinceLookahead: number | null = null;
  let readsCountSeen = false;
  let chainSeen = false;
  for (const {
    tier,
    edgeCount,
    readsGroup,
    readsCount,
    lowersUpper,
  } of rounds) {
    const sharp = edgeCount <= BRIDGES_SHARP_ROUND_EDGE_LIMIT;
    if (goal === "entry") {
      countRounds += tier === "A2" ? 1 : 0;
      value +=
        tier === "A1"
          ? 0
          : tier === "A2"
            ? countRounds === 1
              ? 1
              : -4
            : tier === "D"
              ? -12
              : -6;
      continue;
    }
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
      value += readsCount
        ? readsCountSeen
          ? 3
          : FIRST_COUNT_LOOKAHEAD_SCORE
        : 0;
      value += lowersUpper ? 4 : 0;
      readsCountSeen ||= readsCount;
      if (sinceLookahead !== null && sinceLookahead <= LOOKAHEAD_CHAIN_GAP) {
        value += chainSeen ? 6 : FIRST_CHAINED_LOOKAHEAD_SCORE;
        chainSeen = true;
      }
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
 * 手詰まりの読みを磨く向きに応じて点にし（`scoreRounds`）、交差で塞がった行き先は1つ1点、解の輪（島6つに1つまで）は1つ2点
 * （最初の2つはさらに3点）、
 * 長い橋は1本 0.5点（上限あり）、6以上の数字と7以上の数字があればそれぞれ2点を足す。
 * 数字の平均・2本の割合・数字2の割合・最も多い数字の割合・外周に沿う橋・短い橋・架ける行き先の割合が下限・上限を
 * 外れた分は割り引く。
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
  const loops = Math.min(
    Math.floor(board.islands.length / ISLANDS_PER_SCORED_LOOP),
    Math.max(0, used - board.islands.length + 1),
  );
  value +=
    LOOP_SCORE * loops + FIRST_LOOP_SCORE * Math.min(loops, FIRST_SCORED_LOOPS);
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
  const lengths = edges.flatMap(({ from, to }, edge) => {
    if (solution[edge] === 0) {
      return [];
    }
    const start = board.islands[from]!;
    const end = board.islands[to]!;
    return [
      Math.abs(start.row - end.row) + Math.abs(start.column - end.column),
    ];
  });
  value +=
    LONG_BRIDGE_SCORE *
    Math.min(
      MAXIMUM_SCORED_LONG_BRIDGES,
      lengths.filter((length) => length * 2 >= board.width).length,
    );
  const shortShare =
    lengths.filter((length) => length === 2).length / Math.max(1, used);
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
    Math.max(0, shortShare - MAXIMUM_SHORT_BRIDGE_SHARE) +
    Math.max(0, used / Math.max(1, edges.length) - MAXIMUM_USED_EDGE_SHARE) +
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
 * 島の位置を変えずに、解の橋を1本ずつ変えて、人が読む量の多い盤面へ磨く（焼きなまし）。`steps` 回まで、辺1つの本数を1段変えた
 * 解を作り、全島がつながったまま推理だけで解ける盤面のうち、点が下がらないものと、温度に応じて点が少し下がるものを採る。
 * 途中で最も点の高かった盤面を返し、最も高い点が `REFINEMENT_PATIENCE` 回上がらなければ打ち切る。
 * 島の位置・候補の辺は変えないので、盤面の形の性質（外周・島の数）は広げたときのまま。推理だけで解ける盤面が1つも無ければ `null`。
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
  let improvedAt = 0;
  for (let step = 0; step < steps; step += 1) {
    if (step - improvedAt > REFINEMENT_PATIENCE) {
      break;
    }
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
        improvedAt = step;
      }
    }
  }
  return best === null ? null : { board: best.board, solution: best.solution };
}
