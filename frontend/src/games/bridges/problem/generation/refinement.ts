import {
  BRIDGES_SHARP_ROUND_EDGE_LIMIT,
  type BridgesReasoningRound,
  countBridgesCountReadingPhases,
  findBridgesFewestLookaheadSpots,
  listBridgesIslandsUndecidedByOpening,
  summarizeBridgesLookaheads,
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
 * 磨く向きごとに、盤面が届かせたい読みの量と、超えさせたくない上限。向きはレベルに当たりやすい盤面へ寄せるための目標で、
 * レベルを決めるのは分析と分類（難易度の基準表と同じ所に置くが、生成側は分類を参照しない）。
 * - `minimum`: 届くまでは1つにつき `TARGET_SCORE` を目標の数で割った点を足し、超えた分は1つ `SURPLUS_SCORE` 点だけ足す。
 * - `maximum`: 超えた分を1つ `EXCESS_PENALTY` 点引く。
 */
type Target = { minimum?: number; maximum?: number };

/**
 * 磨くときに数える読みと盤面の量。
 * - `countRounds`: 配分の読み（A2）が要った数字の読みのまとまり（`countBridgesCountReadingPhases`）。
 *   `closures`: 閉じない読みの一か所の気づき。`otherConnectivity`: それ以外の
 *   つながりの読み（3島以上の組・唯一の通り道・掃く手詰まり）。`connectivity`: つながりの読みの手詰まり（先読みはまとめて数える）。
 * - `readings`: ちょうど以外の読みの手詰まり。`passages`: 唯一の通り道。`crossings`: 交差で塞がる行き先。
 * - `lookaheads`・`groupLookaheads`: 1手の先読みの数、組を見る先読みの数（`summarizeBridgesLookaheads`）。
 * - `spots`・`lastLookaheadLateness`: 先読みの場所の最少数と、その解き順で最後の先読みの前に決まっていた行き先の割合
 *   （`findBridgesFewestLookaheadSpots`）。解き進めた経過で場所が1つ以下なら、最少数も経過と同じなので探さない。
 * - `reasonKinds`: 1手の先読みで手を退けた理由（組が閉じる・孤立・本数の破れ・上限を下げる）の種類の数。
 * - `firstLookaheadLateness`: 最初の1手の先読みの前に決まっていた行き先の割合。
 * - `lateClimax`: 最後のつながりの読みの前に決まっていた行き先の割合。
 * - `loops`: 解の輪。
 * - `highClues`・`veryHighClues`: 5以上・6以上の数字の島のうち、解き始めの数字の読みのまとまりで決まらない島。
 * - `longBridges`: 解で橋を架ける組のうち、盤面の一辺の半分以上の長さの組。
 */
type Metrics = Record<
  | "countRounds"
  | "closures"
  | "otherConnectivity"
  | "connectivity"
  | "readings"
  | "passages"
  | "crossings"
  | "lookaheads"
  | "groupLookaheads"
  | "spots"
  | "lastLookaheadLateness"
  | "reasonKinds"
  | "firstLookaheadLateness"
  | "lateClimax"
  | "loops"
  | "highClues"
  | "veryHighClues"
  | "longBridges",
  number
>;

/**
 * 磨く向きごとの目標。
 * - `entry`（L1）: 配分の読みのまとまりちょうど1つ、つながりの読みと先読みは無し、交差で塞がる行き先は2つまで、輪を1つ。
 * - `count`（L2）: 配分の読みのまとまり1つ、2島を閉じない読みちょうど1回、ほかのつながりの読みは無し、輪を1つ。
 * - `closure`（L3）: 配分1つ、つながりの読み3回、閉じない読み1回、交差1つ、5以上の数字1つ、輪1つ、先読みは無し。
 * - `lookahead`（L4）: 配分2つ、つながり3回、読み5回、1手の先読みちょうど1つ、5以上の数字2つ、輪2つ、交差1つ。
 * - `spots`（L5）: 配分2つ、つながり4回、読み6回、1手の先読みを2か所以上で、閉じない読み2回、組を見る先読み、先読みで退けた
 *   理由2種類、最初の先読みが行き先の半分が決まった後、最後の先読みが7割が決まった後、5以上の数字3つ、6以上の数字1つ、
 *   輪2つ、交差2つ。
 * つながりの読みを求める向きでは、唯一の通り道を1つと、最後のつながりの読みが解き進みの6割より後にあることも目標にする。
 */
const targetsByGoal: Record<
  BridgesRefinementGoal,
  Partial<Record<keyof Metrics, Target>>
> = {
  entry: {
    countRounds: { minimum: 1, maximum: 1 },
    connectivity: { maximum: 0 },
    crossings: { maximum: 2 },
    loops: { minimum: 1 },
  },
  count: {
    countRounds: { minimum: 1 },
    closures: { minimum: 1, maximum: 1 },
    otherConnectivity: { maximum: 0 },
    lookaheads: { maximum: 0 },
    loops: { minimum: 1 },
  },
  closure: {
    countRounds: { minimum: 1 },
    connectivity: { minimum: 3 },
    closures: { minimum: 1 },
    passages: { minimum: 1 },
    crossings: { minimum: 1 },
    highClues: { minimum: 1 },
    loops: { minimum: 1 },
    lookaheads: { maximum: 0 },
    lateClimax: { minimum: 0.6 },
  },
  lookahead: {
    countRounds: { minimum: 2 },
    connectivity: { minimum: 3 },
    readings: { minimum: 5 },
    lookaheads: { minimum: 1, maximum: 1 },
    passages: { minimum: 1 },
    crossings: { minimum: 1 },
    highClues: { minimum: 2 },
    loops: { minimum: 2 },
    lateClimax: { minimum: 0.6 },
  },
  spots: {
    countRounds: { minimum: 2 },
    connectivity: { minimum: 4 },
    readings: { minimum: 6 },
    lookaheads: { minimum: 2 },
    spots: { minimum: 2 },
    closures: { minimum: 2 },
    groupLookaheads: { minimum: 1 },
    reasonKinds: { minimum: 2 },
    firstLookaheadLateness: { minimum: 0.5 },
    lastLookaheadLateness: { minimum: 0.7 },
    passages: { minimum: 1 },
    crossings: { minimum: 2 },
    highClues: { minimum: 3 },
    veryHighClues: { minimum: 1 },
    loops: { minimum: 2 },
    longBridges: { minimum: 2 },
    lateClimax: { minimum: 0.6 },
  },
};

/** 目標1つに届いたときの点。届くまでは届いた割合に比べて足す。 */
const TARGET_SCORE = 10;

/** 下限の目標を超えた分の、1つの点。超えた分も少しだけ点にして、読みの多い盤面を選ぶ。 */
const SURPLUS_SCORE = 1;

/** 上限の目標を超えた分の、1つの点（引く）。 */
const EXCESS_PENALTY = 10;

/** 上限も超えた分も点にしない、割合の目標（`lateClimax`）。 */
const ratioMetrics: ReadonlySet<keyof Metrics> = new Set([
  "lateClimax",
  "firstLookaheadLateness",
  "lastLookaheadLateness",
]);

/**
 * 磨くときに保つ数字と形の質。数字の平均・2本の割合は下限、数字2・最も多い数字・外周に沿う橋・間が1マスの橋・架ける行き先の
 * 割合は上限。外れた分を `QUALITY_SHORTFALL_WEIGHT` 倍して引く。長い橋の無い盤面も引く。
 */
const MINIMUM_CLUE_MEAN = 2.8;
/** 5以上の数字を目標にする向き（L3〜L5）の数字の平均の下限。L3〜L5 の分類と同じ。 */
const MINIMUM_UPPER_CLUE_MEAN = 3.0;
const MINIMUM_DOUBLE_BRIDGE_RATIO = 0.3;
const MAXIMUM_TWO_CLUE_SHARE = 0.3;
const MAXIMUM_DOMINANT_CLUE_SHARE = 0.35;
const MAXIMUM_BORDER_BRIDGE_SHARE = 0.45;
const MAXIMUM_SHORT_BRIDGE_SHARE = 0.45;
const MAXIMUM_USED_EDGE_SHARE = 0.85;
const QUALITY_SHORTFALL_WEIGHT = 60;
const MISSING_LONG_BRIDGE_PENALTY = 10;

/** 間が1マスの橋の割合が上限を超えた分に掛ける重み。ほかの質より強く引き、隣の島をつなぐだけの盤面を避ける。 */
const SHORT_BRIDGE_WEIGHT = 200;

/**
 * 解の橋が通る外周の線の割合の上限と、超えた分に掛ける重み。外周に沿う橋の本数が少なくても、長い橋が外周を通ると盤面の枠を
 * なぞる解になるので、通る線の長さで引く。
 */
const MAXIMUM_BORDER_COVERAGE = 0.85;
const BORDER_COVERAGE_WEIGHT = 100;

/**
 * 7 か 8 の島があるときに足す点。上のレベルの札（7 か 8・8）を満たせるよう、大きい数字の島を作る変形を選ぶ。5以上の数字を
 * 目標にする向きだけに足す。L1 の向きにも足すと、7 か 8 のある問題が L1 の半分近くになり、どの問題も同じ決め打ちから始まる。
 */
const SEVEN_SCORE = 2;
const EIGHT_SCORE = 4;

/** 磨く途中で最も高い点がこの回数のあいだ上がらなければ、磨くのを打ち切る。 */
const REFINEMENT_PATIENCE = 700;

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

/** 解き進めた経過と解から、磨くときに数える読みと盤面の量を求める。 */
function measure(
  board: BridgesBoard,
  rounds: readonly BridgesReasoningRound[],
  crossings: number,
  loops: number,
  longBridges: number,
): Metrics {
  const lookahead = summarizeBridgesLookaheads(rounds);
  const lookaheadRounds = rounds.filter(({ tier }) => tier === "D");
  const fewest =
    lookahead.spotCount >= 2
      ? findBridgesFewestLookaheadSpots(board)
      : {
          spotCount: lookahead.spotCount,
          lastLookaheadDecidedRatio: lookaheadRounds.at(-1)?.decidedRatio ?? 0,
        };
  const undecided = listBridgesIslandsUndecidedByOpening(board);
  const lateClues = board.islands.flatMap(({ clue }, island) =>
    undecided[island] ? [clue] : [],
  );
  const countRounds = countBridgesCountReadingPhases(rounds);
  const connectivityRounds = rounds.filter(
    ({ tier }) => tier !== "A1" && tier !== "A2",
  );
  const closures = connectivityRounds.filter(
    ({ tier, edgeCount }) =>
      (tier === "C1p" || tier === "C1g") &&
      edgeCount <= BRIDGES_SHARP_ROUND_EDGE_LIMIT,
  ).length;
  const nonLookahead = connectivityRounds.filter(({ tier }) => tier !== "D");
  return {
    countRounds,
    closures,
    otherConnectivity: nonLookahead.length - closures,
    connectivity: nonLookahead.length + lookahead.lookaheads.length,
    readings: countRounds + nonLookahead.length + lookahead.lookaheads.length,
    passages: rounds.filter(({ tier }) => tier === "C3").length,
    crossings,
    lookaheads: lookahead.lookaheads.length,
    groupLookaheads: lookahead.lookaheads.filter(({ readsGroup }) => readsGroup)
      .length,
    spots: fewest.spotCount,
    lastLookaheadLateness: fewest.lastLookaheadDecidedRatio,
    reasonKinds: [
      lookahead.lookaheads.some(({ readsClosure }) => readsClosure),
      lookahead.lookaheads.some(({ readsIsolation }) => readsIsolation),
      lookahead.lookaheads.some(({ readsCount }) => readsCount),
      lookahead.lookaheads.some(({ lowersUpper }) => lowersUpper),
    ].filter(Boolean).length,
    firstLookaheadLateness: lookaheadRounds[0]?.decidedRatio ?? 0,
    lateClimax: connectivityRounds.at(-1)?.decidedRatio ?? 0,
    loops,
    highClues: lateClues.filter((clue) => clue >= 5).length,
    veryHighClues: lateClues.filter((clue) => clue >= 6).length,
    longBridges,
  };
}

/** 磨く向きの目標に照らした点。 */
function scoreTargets(metrics: Metrics, goal: BridgesRefinementGoal): number {
  let value = 0;
  for (const [key, { minimum, maximum }] of Object.entries(
    targetsByGoal[goal],
  ) as [keyof Metrics, Target][]) {
    const amount = metrics[key];
    if (minimum !== undefined) {
      value +=
        amount >= minimum
          ? TARGET_SCORE +
            (ratioMetrics.has(key) ? 0 : SURPLUS_SCORE * (amount - minimum))
          : (TARGET_SCORE * amount) / minimum;
    }
    if (maximum !== undefined && amount > maximum) {
      value -= EXCESS_PENALTY * (amount - maximum);
    }
  }
  return value;
}

/**
 * 盤面を点にする。1手の先読みまでの推理で解き切れる盤面だけに点を付け、ほかは `null`。
 * 推理の段はどれも盤面から必ず言えることだけを決めるので、推理で全辺が決まり全島がつながれば解はそれだけで、一意解になる。
 * 磨く向きの目標に照らした点（`scoreTargets`）に、7 か 8 の島の点を足し、数字と形の質の下限・上限を外れた分と、長い橋の
 * 無いことを引く。
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
  const clues = board.islands.map(({ clue }) => clue);
  const used = solution.filter((bridges) => bridges > 0).length;
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
  let shortBridges = 0;
  let longBridges = 0;
  let borderBridges = 0;
  let borderCoverage = 0;
  for (const [edge, { from, to }] of edges.entries()) {
    if (solution[edge] === 0) {
      continue;
    }
    const start = board.islands[from]!;
    const end = board.islands[to]!;
    const length =
      Math.abs(start.row - end.row) + Math.abs(start.column - end.column);
    shortBridges += length === 2 ? 1 : 0;
    longBridges += length * 2 >= board.width ? 1 : 0;
    const alongBorder =
      (start.row === end.row && (start.row === 0 || start.row === last)) ||
      (start.column === end.column &&
        (start.column === 0 || start.column === last));
    borderBridges += alongBorder ? 1 : 0;
    borderCoverage += alongBorder ? length : 0;
  }
  let value = scoreTargets(
    measure(
      board,
      trace.rounds,
      trace.crossingBlockCount,
      used - board.islands.length + 1,
      longBridges,
    ),
    goal,
  );
  if (targetsByGoal[goal].highClues !== undefined) {
    value += clues.some((clue) => clue >= 7) ? SEVEN_SCORE : 0;
    value += clues.some((clue) => clue >= 8) ? EIGHT_SCORE : 0;
  }
  const shortfall =
    Math.max(0, used / Math.max(1, edges.length) - MAXIMUM_USED_EDGE_SHARE) +
    Math.max(
      0,
      borderBridges / Math.max(1, used) - MAXIMUM_BORDER_BRIDGE_SHARE,
    ) +
    Math.max(
      0,
      (targetsByGoal[goal].highClues === undefined
        ? MINIMUM_CLUE_MEAN
        : MINIMUM_UPPER_CLUE_MEAN) - clueMean,
    ) +
    Math.max(0, MINIMUM_DOUBLE_BRIDGE_RATIO - doubleRatio) +
    Math.max(0, twoShare - MAXIMUM_TWO_CLUE_SHARE) +
    Math.max(0, dominantShare - MAXIMUM_DOMINANT_CLUE_SHARE);
  return {
    value:
      value -
      QUALITY_SHORTFALL_WEIGHT * shortfall -
      SHORT_BRIDGE_WEIGHT *
        Math.max(
          0,
          shortBridges / Math.max(1, used) - MAXIMUM_SHORT_BRIDGE_SHARE,
        ) -
      BORDER_COVERAGE_WEIGHT *
        Math.max(0, borderCoverage / (4 * last) - MAXIMUM_BORDER_COVERAGE) -
      (longBridges === 0 ? MISSING_LONG_BRIDGE_PENALTY : 0),
  };
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
